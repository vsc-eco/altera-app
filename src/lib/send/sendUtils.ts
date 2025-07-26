import { getAccounts } from '@aioha/aioha/build/rpc';
import { type Account, postingMetadataFromString } from '$lib/auth/hive/accountTypes';
import { getDidFromUsername, getUsernameFromAuth, getUsernameFromDid } from '$lib/getAccountName';
import swapOptions, {
	Network,
	networkMap,
	SendAccount,
	TransferMethod,
	type CoinOptions,
	type IntermediaryNetwork,
	type NecessarySendDetails,
	type SendDetails
} from './sendOptions';
import { authStore, type Auth } from '$lib/auth/store';
import { executeTx, getSendOpGenerator, getSendOpType } from '$lib/vscTransactions/hive';
import { getEVMOpType } from '$lib/vscTransactions/eth';
import { CoinAmount } from '$lib/currency/CoinAmount';
import type { TransferOperation } from '@hiveio/dhive';
import { addLocalTransaction } from '../stores/localStorageTxs';
import { createClient, signAndBrodcastTransaction } from '$lib/vscTransactions/eth/client';
import { wagmiSigner } from '$lib/vscTransactions/eth/wagmi';
import { wagmiConfig } from '$lib/auth/reown';
import { get, writable } from 'svelte/store';
import { vscTxsStore, waitForExtend, type TransactionInter } from '$lib/stores/txStores';
import moment from 'moment';
import { getIntermediaryNetwork } from './getNetwork';

export const SendTxDetails = writable<SendDetails>(blankDetails());

export function blankDetails() {
	return {
		fromCoin: undefined,
		fromNetwork: undefined,
		fromAmount: '0',
		toCoin: undefined,
		toNetwork: undefined,
		toAmount: '0',
		toUsername: '',
		toDisplayName: '',
		method: undefined,
		account: undefined,
		fee: undefined
	};
}

let tx_session_id = 0;

export function getTxSessionId() {
	return ++tx_session_id;
}

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

// increment through store, keep fetching more to find last paid
export async function getLastPaidContact(auth: Auth, toDid: string) {
	if (!auth.value?.did) return 'Never';
	let lastChecked = 0;
	let lastLength = 0;
	let store: TransactionInter[];
	do {
		store = get(vscTxsStore);
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (op?.data.to === toDid) {
					return `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
				}
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did);
		if (!success) {
			break;
		}
	} while (store.length > lastLength);
	return 'Never';
}
export async function getLastPaidNetwork(auth: Auth, netVal?: string) {
	if (!auth.value?.did || !netVal) return 'Never';
	let lastChecked = 0;
	let lastLength = 0;
	let store: TransactionInter[];
	do {
		store = get(vscTxsStore);
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			if (netVal.startsWith(tx.type)) {
				return `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did);
		if (!success) {
			break;
		}
	} while (store.length > lastLength);
	return 'Never';
}

export async function getFee(toAmount: string) {
	const store = get(SendTxDetails);
	// console.log("getFee called",
	// 	store.fromCoin,
	// 	store.fromNetwork,
	// 	store.toCoin,
	// 	store.toNetwork
	// )
	if (
		store.fromCoin &&
		store.fromNetwork &&
		store.toCoin &&
		store.toCoin.coin.value !== coins.usd.value &&
		store.toNetwork
	) {
		const fee = await getIntermediaryNetwork(
			{ coin: store.fromCoin.coin, network: store.fromNetwork },
			{ coin: store.toCoin.coin, network: store.toNetwork }
		).feeCalculation(new CoinAmount(Number(toAmount), store.toCoin.coin), store.fromCoin.coin);
		return fee;
	}
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

function getAccountsFromMethod(method: TransferMethod, did: string) {
	if (method.value === TransferMethod.lightningTransfer.value) {
		return [SendAccount.swap]
	}
	let result = [SendAccount.vscAccount];
	if (did.startsWith('hive:')) {
		result.push(SendAccount.deposit);
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
	return Object.values(Network).filter(net => set.has(net.value));
}

export function solveNetworkConstraints(
	method: TransferMethod | undefined,
	fromCoin: CoinOptions['coins'][number] | undefined,
	toNetwork: Network | undefined,
	did: string | undefined,
	account?: SendAccount
): Constraints {
	// console.log("parameters to solve constraints", method, fromCoin, did, account);
	if (!did)
		return {
			assetOptions: [],
			accountOptions: [],
			networkOptions: []
		};

	// given account: what are the network options
	const accountOptions = method ? getAccountsFromMethod(method, did) : Object.values(SendAccount);
	// if (accountOptions?.length === 1) {
	// 	account = accountOptions[0];
	// }
	let accountNetworkOptions: Set<string> = method
		? createSet(getMethodNetworks(method, did))
		: createSet(Object.values(Network));

	if (account) {
		const accountNetworks = createSet(getNetworksFromAccount(account, did) ?? []);
		accountNetworkOptions = accountNetworkOptions.intersection(accountNetworks);
	}

	// asset options based allowed on networks allowed by accounts
	const assetFromOptions = toNetworkArr(accountNetworkOptions).reduce<CoinOptions['coins']>(
		(acc, net) => {
			const coins = networkMap.get(net.value);
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
	// keeps only coins that are also in the toNetwork
	const assetOptions: CoinOptions['coins'] = (() => {
		if (!toNetwork) {
			return [];
		}

		if (account?.value === SendAccount.swap.value) {
			const coins = networkMap.get(toNetwork.value);
			if (!coins) return [];
			return coins
				.map((coin) => ({
					coin: coin,
					networks: swapOptions.from.coins.find((coinOpt) => coinOpt.coin.value === coin.value)
						?.networks ?? [toNetwork]
				}))
				.filter((coinOpt) =>
					swapOptions.to.coins.map((coin) => coin.coin.value).includes(coinOpt.coin.value)
				);
		}
		return assetFromOptions.filter((coinOpt) =>
			networkMap
				.get(toNetwork.value)
				?.map((coin) => coin.value)
				?.includes(coinOpt.coin.value)
		);
	})();

	let coinNetworkOptions: Set<string> = method
		? createSet(getMethodNetworks(method, did))
		: createSet(Object.values(Network));
	if (fromCoin) {
		const coinNetworks = createSet(fromCoin.networks);
		coinNetworkOptions = coinNetworkOptions.intersection(coinNetworks);
	}

	// console.log('acc opts, coin opts', accountNetworkOptions, coinNetworkOptions);
	const networkOptions = toNetworkArr(
		!account || account.value === SendAccount.swap.value
			? accountNetworkOptions
			: accountNetworkOptions.intersection(coinNetworkOptions)
	);
	

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
	setStatus: (status: string, isError?: boolean) => void
): Promise<Error | { id: string }> {
	const { fromCoin, fromNetwork, amount, toCoin, toNetwork, toUsername } = details;
	if (intermediary == Network.vsc) {
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

			const id = await signAndBrodcastTransaction([sendOp], wagmiSigner, client, wagmiConfig)
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
						if (error.message.includes('wallet')) {
							setStatus('Please connect your wallet and try again.', true);
						} else if (error.message.includes('422')) {
							setStatus('Transaction format error. Please check your inputs and try again.', true);
						} else if (error.message.includes('network') || error.message.includes('Network')) {
							setStatus('Network error. Please check your connection and try again.', true);
						} else if (error.message.includes('not enough RCS')) {
							setStatus('Not enough Resource Credits. Please deposit HBD and try again.', true);
						} else {
							setStatus(error.message, true);
						}
						return error;
					}
					setStatus('Transaction failed.', true);
					return new Error('Transaction failed.');
				});
			return id;
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
		setStatus(res.error, true);
		return new Error(res.error);
	}

	if (intermediary == Network.hiveMainnet) {
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
