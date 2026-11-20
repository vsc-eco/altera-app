/**
 * Deposits from Ethereum into the Magi EVM bridge.
 *
 * The bridge credits a plain ETH or ERC-20 transfer to the active vault to the
 * SENDER's Magi account (did:pkh:eip155), and a plain ETH transfer may carry
 * UTF-8 calldata "deposit_to=<Magi account>" to credit someone else
 * (evm-mapping-contract handlers.go parseCalldataInstructions). So:
 *  - logged in with an Ethereum wallet: a plain transfer from that wallet, sent
 *    here through wagmi, lands on the same account;
 *  - any login (Hive included): ETH or USDC through the MagiDeposit contract,
 *    whose call names the account to credit (sendMagiDepositFromBrowserWallet);
 *    The page lists the wallets installed in the browser (EIP-6963) and asks the
 *    chosen one to sign; no address or hex data is shown to copy.
 */
import {
	getAccount,
	sendTransaction,
	switchChain,
	waitForTransactionReceipt,
	writeContract
} from '@wagmi/core';
import { erc20Abi, getAddress, isAddress, toHex, type Hex } from 'viem';
import { SimulateContractCallsStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { initModal, wagmiConfig } from '$lib/auth/reown';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { toChainUnits } from '$lib/currency/chainAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { ETH_CHAIN_ID, EVM_BRIDGE_CONTRACT_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';

/**
 * The address deposits go to: the bridge's active vault generation, read with
 * a vaultInfo dry run (null if the node cannot say or no generation is active).
 */
export async function fetchActiveVaultAddress(callerDid: string): Promise<string | null> {
	try {
		const res = await queryOnce(new SimulateContractCallsStore(), {
			variables: {
				account: callerDid,
				input: {
					tx_id: `altera-vault-${Date.now()}`,
					required_auths: [callerDid],
					calls: [
						{
							contract_id: EVM_BRIDGE_CONTRACT_ID,
							action: 'vaultInfo',
							payload: '{}',
							rc_limit: 5000
						}
					]
				}
			},
			policy: 'NetworkOnly'
		});
		const sim = res.data?.simulateContractCalls?.[0];
		if (!sim?.success || !sim.ret) return null;
		const info = JSON.parse(sim.ret) as {
			active?: number;
			generations?: { generation: number; address?: string; status?: string }[];
		};
		const gen = info.generations?.find((g) => g.generation === info.active);
		return gen?.address ? getAddress(gen.address) : null;
	} catch (err) {
		console.error('vaultInfo dry run failed', err);
		return null;
	}
}

/** The calldata a plain ETH deposit carries to credit `recipient` (e.g. "hive:alice"). */
export function depositToCalldata(recipient: string): Hex {
	return toHex(`deposit_to=${recipient}`);
}

/**
 * The active vault generation's MagiDeposit contract (account-mapping
 * l1-deposit/MagiDeposit.sol), read with a depositAddress dry run: null until the
 * bridge has attested its code. Its deposit(recipient) and
 * depositToken(token, amount, recipient) credit ANY Magi account the call names
 * (RP-7), so a Hive account can be credited ETH and USDC without hex data.
 */
export async function fetchDepositContractAddress(callerDid: string): Promise<string | null> {
	try {
		const res = await queryOnce(new SimulateContractCallsStore(), {
			variables: {
				account: callerDid,
				input: {
					tx_id: `altera-deposit-contract-${Date.now()}`,
					required_auths: [callerDid],
					calls: [
						{
							contract_id: EVM_BRIDGE_CONTRACT_ID,
							action: 'depositAddress',
							payload: '',
							rc_limit: 5000
						}
					]
				}
			},
			policy: 'NetworkOnly'
		});
		const sim = res.data?.simulateContractCalls?.[0];
		const ret = sim?.success ? (sim.ret ?? '').trim().replace(/^"|"$/g, '') : '';
		return isAddress(ret) ? getAddress(ret) : null;
	} catch (err) {
		console.error('depositAddress dry run failed', err);
		return null;
	}
}

/**
 * Send ETH or USDC from the connected Ethereum wallet to the vault, credited to
 * that wallet's own Magi account. Returns the Ethereum transaction hash once it
 * is mined (the bridge credits it after finality and a header proof).
 */
export async function sendBridgeDepositFromWallet(
	amount: CoinAmount<Coin>,
	vaultAddress: string,
	/** The address the user is logged in with: the deposit is credited to the
	 *  sender, so a wallet switched to another account must not send. */
	expectedAddress: string
): Promise<Hex> {
	initModal();
	const config = wagmiConfig;
	if (!config) throw new Error('The Ethereum wallet is not ready. Reload and try again.');
	const account = getAccount(config);
	if (!account.address) throw new Error('Connect your Ethereum wallet first.');
	if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
		throw new Error(
			`Your wallet is on ${account.address}, not ${expectedAddress} that you are logged in with. ` +
				'Switch back to that account: a deposit is credited to the address that sends it.'
		);
	}
	if (account.chainId !== ETH_CHAIN_ID) await switchChain(config, { chainId: ETH_CHAIN_ID });
	const vault = getAddress(vaultAddress);
	const value = BigInt(toChainUnits(amount));
	let hash: Hex;
	if (amount.coin.value === Coin.eth.value) {
		hash = await sendTransaction(config, { to: vault, value, chainId: ETH_CHAIN_ID });
	} else if (amount.coin.value === Coin.usdc.value) {
		hash = await writeContract(config, {
			address: getAddress(USDC_TOKEN_ADDRESS),
			abi: erc20Abi,
			functionName: 'transfer',
			args: [vault, value],
			chainId: ETH_CHAIN_ID
		});
	} else {
		throw new Error(`${amount.coin.label} cannot be deposited through the EVM bridge`);
	}
	const receipt = await waitForTransactionReceipt(config, { hash, chainId: ETH_CHAIN_ID });
	if (receipt.status !== 'success') throw new Error(`The deposit transaction reverted (${hash}).`);
	return hash;
}

/** Block explorer link for an Ethereum transaction (Sepolia on testnet). */
export function etherscanTxUrl(hash: string): string {
	return ETH_CHAIN_ID === 1
		? `https://etherscan.io/tx/${hash}`
		: `https://sepolia.etherscan.io/tx/${hash}`;
}
