import type {
	TransferTransaction,
	DepositTransaction,
	WithdrawTransaction,
	CallContractTransaction
} from '../eth/client';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import type { TransferInput, UnmapInput } from '../bitcoin/bitcoinContractCalls';
import { getHiveAssetName, getHbdAssetName } from '../../../client';
import { BTC_MAPPING_CONTRACT_ID, EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { isEvmBridgeCoin } from '../evmBridge';
import { getEvmUnmapCall } from '../hive/vscOperations/evm';
import { toChainUnits } from '$lib/currency/chainAmount';

export function getEVMOpType(
	fromNetwork: Network,
	toNetwork: Network,
	fromDid: string,
	toDid: string,
	amount: CoinAmount<
		typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc | typeof Coin.eth | typeof Coin.usdc
	>,
	/** ETH/USDC withdrawal to Ethereum: take the bridge fee from the amount. */
	deductFee?: boolean
): TransferTransaction | DepositTransaction | WithdrawTransaction | CallContractTransaction {
	// ETH/USDC live on the EVM bridge (one contract, the asset named in each call).
	if (isEvmBridgeCoin(amount.coin)) {
		if (toNetwork.value === Network.magi.value) {
			return {
				op: 'call',
				payload: {
					contract_id: EVM_BRIDGE_CONTRACT_ID,
					action: 'transfer',
					payload: JSON.stringify({
						amount: toChainUnits(amount),
						to: toDid,
						asset: amount.coin.value
					}),
					rc_limit: 1000,
					intents: [],
					caller: fromDid
				}
			};
		}
		if (toNetwork.value === Network.ethMainnet.value) {
			const ethAddress = toDid.startsWith('did:') ? toDid.split(':').at(-1)! : toDid;
			const call = getEvmUnmapCall(ethAddress, amount, deductFee);
			return {
				op: 'call',
				payload: {
					contract_id: EVM_BRIDGE_CONTRACT_ID,
					action: call.action,
					payload: JSON.stringify(call.payload),
					// sized from a dry run in sendUtils, like the BTC unmap
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};
		}
		throw new Error(`${amount.coin.label} cannot go to ${toNetwork.label}`);
	}
	if (amount.coin.value === Coin.btc.value) {
		if (toNetwork.value === Network.magi.value) {
			const payload: TransferInput = {
				amount: amount.amount.toString(),
				to: toDid
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: BTC_MAPPING_CONTRACT_ID,
					action: 'transfer',
					payload: JSON.stringify(payload),
					rc_limit: 1000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		} else if (toNetwork.value === Network.btcMainnet.value) {
			const btcAddress = toDid.startsWith('did:') ? toDid.split(':').at(-1)! : toDid;
			const payload: UnmapInput = {
				amount: amount.amount.toString(),
				to: btcAddress
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: BTC_MAPPING_CONTRACT_ID,
					action: 'unmap',
					payload: JSON.stringify(payload),
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		}
	}
	// Use asset from localStorage (e.g. TESTS/TBD for testnet), fallback to HIVE/HBD
	const assetName =
		amount.coin.value === Coin.hbd.value
			? getHbdAssetName()
			: amount.coin.value === Coin.hive.value
				? getHiveAssetName()
				: amount.coin.unit;
	let payload = {
		from: fromDid,
		to: toDid,
		amount: amount.toPrettyAmountString(),
		asset: assetName.toLowerCase()
	};
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.magi.value) {
		return {
			op: 'transfer',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.hiveMainnet.value && toNetwork.value == Network.magi.value) {
		return {
			op: 'deposit',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.hiveMainnet.value) {
		return {
			op: 'withdraw',
			payload: payload
		};
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
}
