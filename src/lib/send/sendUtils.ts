import { getAccounts } from '@aioha/aioha/build/rpc';
import { type Account, postingMetadataFromString } from '$lib/auth/hive/accountTypes';
import { getDidFromUsername, getUsernameFromAuth, getUsernameFromDid } from '$lib/getAccountName';
import {
	Network,
	networkMap,
	SendAccount,
	TransferMethod,
	type CoinOptions,
	type IntermediaryNetwork,
	type NecessarySendDetails,
	type SendDetails
} from './sendOptions';
import type { Auth } from '$lib/auth/store';
import { executeTx, getSendOpGenerator, getSendOpType } from '$lib/vscTransactions/hive';
import { getEVMOpType } from '$lib/vscTransactions/eth';
import { CoinAmount } from '$lib/currency/CoinAmount';
import type { TransferOperation } from '@hiveio/dhive';
import { addLocalTransaction } from '../stores/localStorageTxs';
import { createClient, signAndBrodcastTransaction } from '$lib/vscTransactions/eth/client';
import { wagmiSigner } from '$lib/vscTransactions/eth/wagmi';
import { wagmiConfig } from '$lib/auth/reown';
import { writable } from 'svelte/store';

export const SendTxDetails = writable<SendDetails>({
	fromCoin: undefined,
	fromNetwork: undefined,
	fromAmount: '0',
	toCoin: undefined,
	toNetwork: undefined,
	toUsername: '',
	toDisplayName: '',
	method: undefined,
	account: undefined
});

export async function getDisplayName(did: string) {
	if (!did.startsWith('hive:')) {
		return;
	}
	const accountInfo: Account = (await getAccounts([getUsernameFromDid(did)])).result[0];
	if (!accountInfo?.posting_json_metadata) {
		return;
	}
	const postingMetadata = postingMetadataFromString(accountInfo.posting_json_metadata).profile;
	if (postingMetadata['name']) {
		return postingMetadata['name'];
	}
}

export function getRecipientNetworks(did: string): (IntermediaryNetwork | Network)[] {
	if (did.startsWith('hive:')) {
		return [Network.hiveMainnet, Network.vsc];
	}
	if (did.startsWith('did:pkh:eip155:1:')) {
		return [Network.vsc];
	}
	return [];
}

export function getMethodNetworks(method: TransferMethod, did: string) {
	if (method.value === TransferMethod.vscTransfer.value) {
		let result = [Network.vsc];
		if (did.startsWith('hive:')) {
			result.push(Network.hiveMainnet);
		}
		return result;
	} else if (method.value === TransferMethod.lightningTransfer.value) {
		return [Network.lightning];
	}
	return [];
}

type AccsNetsPair =
	| {
			accounts: SendAccount[];
			networks?: Network[];
	  }
	| undefined;

export function getFromOptions(
	method: TransferMethod | undefined,
	did: string | undefined
): AccsNetsPair {
	console.log('getfromopts', method, did);
	if (!method || !did) {
		return;
	}
	if (method.value === TransferMethod.vscTransfer.value) {
		let result: AccsNetsPair = { accounts: [SendAccount.vscAccount] };
		if (did.startsWith('hive:')) {
			result.accounts.push(SendAccount.deposit);
			result.networks = [Network.hiveMainnet];
		}
		return result;
	} else if (method.value === TransferMethod.lightningTransfer.value) {
		return {
			accounts: [SendAccount.swap],
			networks: [Network.lightning]
		};
	}
	return;
}

function getNetworksFromAccount(account: SendAccount, did: string) {
	if (account.value === SendAccount.deposit.value && did.startsWith('hive:')) {
		return [Network.hiveMainnet];
	}
	if (account.value === SendAccount.vscAccount.value) {
		return [Network.vsc];
	}
	if (account.value === SendAccount.swap.value) {
		return [Network.lightning];
	}
}

function getAccountsFromNetworks(networks: Network[]) {
	let result: SendAccount[] = [];
	if (networks.find((net) => net.value === Network.vsc.value)) {
		result.push(SendAccount.vscAccount);
	}
	if (networks.find((net) => net.value === Network.hiveMainnet.value)) {
		result.push(SendAccount.deposit);
	}
	if (networks.find((net) => net.value === Network.lightning.value)) {
		result.push(SendAccount.swap);
	}
	return result;
}

type Constraints = {
	assetOptions: CoinOptions['coins'];
	networkOptions: Network[];
	accountOptions: SendAccount[];
};

function createSet(arr: { value: string; [key: string]: any }[]) {
	return new Set(arr.map((item) => item.value));
}

function toNetworkArr(set: Set<string>) {
	const allNets = networkMap.keys();
	let result: Network[] = [];
	Array.from(set).forEach((entry) => {
		const network = allNets.find((net) => net.value === entry);
		if (network) result.push(network);
	});
	return result;
}

export function solveNetworkConstraints(
	method: TransferMethod | undefined,
	fromCoin: CoinOptions['coins'][number] | undefined,
	did: string | undefined,
	account?: SendAccount
): Constraints {
	// console.log("parameters to solve constraints", method, fromCoin, did, account);
	if (!method || !did)
		return {
			assetOptions: [],
			accountOptions: [],
			networkOptions: []
		};
	// given account: what are the network options
	let accountNetworkOptions: Set<string> = createSet(getMethodNetworks(method, did));

	if (account) {
		const accountNetworks = createSet(getNetworksFromAccount(account, did) ?? []);
		accountNetworkOptions = accountNetworkOptions.intersection(accountNetworks);
	}

	const assetOptions = toNetworkArr(accountNetworkOptions).reduce<CoinOptions['coins']>(
		(acc, net) => {
			const coins = networkMap.get(net);
			if (!coins) return acc;
			for (const coin of coins) {
				const existing = acc.find((item) => item.coin.value === coin.value);
				if (existing) {
					if (!existing.networks.find((n) => n.value === net.value)) {
						existing.networks.push(net);
					}
				} else {
					acc.push({ coin, networks: [net] });
				}
			}
			return acc;
		},
		[]
	);

	let coinNetworkOptions: Set<string> = createSet(getMethodNetworks(method, did));
	if (fromCoin) {
		const coinNetworks = createSet(fromCoin.networks);
		coinNetworkOptions = coinNetworkOptions.intersection(coinNetworks);
	}
	const accountOptions = getAccountsFromNetworks(toNetworkArr(coinNetworkOptions));

	// console.log('acc opts, coin opts', accountNetworkOptions, coinNetworkOptions);
	const networkOptions = toNetworkArr(accountNetworkOptions.intersection(coinNetworkOptions));
	// console.log('network options', networkOptions);

	return {
		assetOptions: assetOptions,
		accountOptions: accountOptions,
		networkOptions: networkOptions
	};
}

export async function send(
	details: NecessarySendDetails,
	auth: Auth,
	intermediary: IntermediaryNetwork,
	setStatus: (status: string) => void
): Promise<Error | { id: string }> {
	const { fromCoin, fromNetwork, amount, toCoin, toNetwork, toUsername } = details;

	console.log('in send()');

	if (intermediary == Network.vsc) {
		console.log('intermediary network identified as vsc');
		if (auth.value?.provider == 'reown') {
			// account check in signAndBroadcast
			const client = createClient(auth.value.did);

			const sendOp = getEVMOpType(
				fromNetwork,
				toNetwork,
				auth.value.did,
				getDidFromUsername(toUsername),
				new CoinAmount(amount, toCoin.coin)
			);

			setStatus('Preparing transaction for signing…');

			const result = await signAndBrodcastTransaction([sendOp], wagmiSigner, client, wagmiConfig)
				.then((result) => {
					setStatus(`Transaction submitted successfully!`);
					// TODO: add back once backend fixed
					// addLocalTransaction({
					// 	ops: [
					// 		{
					// 			data: {
					// 				...sendOp.payload,
					// 				type: sendOp.op
					// 			},
					// 			type: sendOp.op,
					// 			index: 0
					// 		}
					// 	],
					// 	timestamp: new Date(),
					// 	id: result.id,
					// 	type: 'vsc'
					// });
					return { id: result.id };
				})
				.catch((error) => {
					if (error instanceof Error) {
						if (error.message.includes('User rejected') || error.message.includes('rejected')) {
							setStatus('Transaction was cancelled by user');
						} else if (error.message.includes('wallet')) {
							setStatus('Please connect your wallet and try again');
						} else if (error.message.includes('422')) {
							setStatus('Transaction format error. Please check your inputs and try again');
						} else if (error.message.includes('network') || error.message.includes('Network')) {
							setStatus('Network error. Please check your connection and try again');
						} else if (error.message.includes('not enough RCS')) {
							setStatus('Not enough Resource Credits. Please deposit HBD and try again.');
						} else {
							setStatus('Transaction failed.');
						}
						return error;
					}
					setStatus('Transaction failed.');
					return new Error('Transaction failed.');
				});
			return result;
		}
		if (!auth.value?.aioha)
			return new Error("VSC Transactions via an EVM wallet isn't supported yet.");
		const getSendOp = getSendOpGenerator(fromNetwork, toNetwork);
		const opType = getSendOpType(fromNetwork, toNetwork);
		setStatus('Waiting for Hive wallet approval…');
		// note that fromCoin and toCoin should be the same
		const sendOp = getSendOp(
			auth.value.username!,
			getDidFromUsername(toUsername),
			new CoinAmount(amount, toCoin.coin)
		);
		const res = await executeTx(auth.value.aioha, [sendOp]);
		if (res.success) {
			setStatus('Transaction submitted. You will be notified when your transaction is finished.');
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(amount, toCoin!.coin).toAmountString(),
							asset: toCoin!.coin.unit.toLowerCase(),
							from: auth.value.did,
							to: getDidFromUsername(toUsername),
							memo: sendOp[1]?.memo ?? '',
							type: 'transfer'
						},
						type: opType!,
						index: 0
					}
				],
				timestamp: new Date(),
				id: res.result,
				type: 'hive'
			});
			return { id: res.result };
		}
		return new Error(res.error);
	}

	if (intermediary == Network.hiveMainnet) {
		console.log('intermediary network identified as hive');
		if (!auth.value?.aioha)
			return new Error("Hive Mainnet Transactions via an EVM wallet aren't supported yet.");
		setStatus('Waiting for Hive wallet approval…');
		const toCoinAmount = new CoinAmount(amount, toCoin!.coin);
		const res = await executeTx(auth.value?.aioha, [
			[
				'transfer',
				{
					from: auth.value.username!,
					to: toUsername,
					amount: toCoinAmount.toPrettyString(),
					memo: ''
				}
			] satisfies TransferOperation
		]);
		if (res.success) {
			setStatus('Transaction submitted. You will be notified when your transaction is finished.');
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(amount, toCoin!.coin).toAmountString(),
							asset: toCoin!.coin.unit.toLowerCase(),
							from: auth.value.did,
							to: getDidFromUsername(toUsername),
							memo: '',
							type: 'transfer'
						},
						type: 'transfer',
						index: 0
					}
				],
				timestamp: new Date(),
				id: res.result,
				type: 'hive'
			});
			return { id: res.result };
		}
		return new Error(res.error);
	}
	return new Error('Unexpected Error: Unsupported transaction.');
}
