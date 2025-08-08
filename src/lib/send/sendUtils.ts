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
import { type Auth } from '$lib/auth/store';
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
		fee: undefined,
		memo: ''
	};
}

let tx_session_id = 0;

export function getTxSessionId() {
	return ++tx_session_id;
}

export async function getDisplayName(did: string) {
	if (!did.startsWith('hive:')) {
		return null;
	}
	const accountInfo: Account = (await getAccounts([getUsernameFromDid(did)])).result[0];
	if (!accountInfo) {
		return null;
	}
	if (!accountInfo.posting_json_metadata) {
		return undefined;
	}
	const postingMetadata = postingMetadataFromString(accountInfo.posting_json_metadata).profile;
	if (postingMetadata['name']) {
		return postingMetadata['name'];
	}
}

export function getRecipientNetworks(did: string): NetworkOptionParam[] {
	if (did.startsWith('hive:')) {
		return [Network.hiveMainnet, Network.vsc];
	}
	if (did.startsWith('did:pkh:eip155:1:')) {
		return [
			Network.vsc,
			{
				...Network.hiveMainnet,
				disabled: true,
				disabledMemo: `Not available for ${did.startsWith('did:pkh:eip155:1:') ? 'EVM accounts' : "recipient's account type"}`
			}
		];
	}
	return [];
}

function getMethodNetworks(method: TransferMethod) {
	if (method.value === TransferMethod.vscTransfer.value) {
		return [Network.vsc, Network.hiveMainnet];
	} else if (method.value === TransferMethod.lightningTransfer.value) {
		return [Network.lightning];
	}
	return [];
}

function getDidNetworks(did: string) {
	let result = [Network.vsc, Network.lightning];
	if (did.startsWith('hive:')) result.push(Network.hiveMainnet);
	return result;
}

const lastPaidCache: {
	contacts: Map<string, string>;
	networks: Map<string, string>;
	lastLength: number;
} = {
	contacts: new Map(),
	networks: new Map(),
	lastLength: 0
};
// increment through store, keep fetching more to find last paid
export async function getLastPaidContact(auth: Auth, toDid: string) {
	if (!auth.value?.did) return 'Never';
	const cached = lastPaidCache.contacts.get(toDid);
	if (cached) return cached;
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
					const lastPaidString = `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
					lastPaidCache.contacts.set(toDid, lastPaidString);
					return lastPaidString;
				}
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did);
		if (!success) {
			break;
		}
	} while (store.length > lastLength);
	lastPaidCache.contacts.set(toDid, 'Never');
	return 'Never';
}

// TODO: probably use a record instead, to filter by name but keep other data
export type recipientData = {
	name: string;
	did: string;
	date: string | undefined;
};
export async function getRecentContacts(auth: Auth): Promise<recipientData[]> {
	if (!auth.value) return [];
	let result = new Map<string, recipientData>();
	let leaveOut = ['v4vapp'];
	let lastChecked = 0;
	let lastLength = 0;
	let store: TransactionInter[];
	do {
		store = get(vscTxsStore);
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (!op || op.data.from !== auth.value.did) continue;
				const username = getUsernameFromDid(op.data.to);
				if (!leaveOut.includes(username) && !result.has(username)) {
					result.set(username, {
						name: (await getDisplayName(op.data.to)) ?? username,
						did: op.data.to,
						date: tx.anchr_ts + 'Z'
					});
				}
				if (result.size >= 3) {
					for (const data of result.values()) {
						const lastPaidString = `on ${moment(data.date).format('MMM DD, YYYY')}`;
						lastPaidCache.contacts.set(data.did, lastPaidString);
					}
					return [...result.values()];
				}
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did, 30);
		if (!success) {
			break;
		}
	} while (store.length > lastLength);

	store = get(vscTxsStore);
	for (const tx of store) {
		if (!tx.ops) continue;
		for (const op of tx.ops) {
			if (!op || !op.data.from) continue;
			const username = getUsernameFromDid(op.data.from);
			if (!leaveOut.includes(username) && !result.has(username)) {
				result.set(username, {
					name: (await getDisplayName(op.data.from)) ?? username,
					did: op.data.from,
					date: undefined
				});
			}
			if (result.size >= 3) {
				for (const data of result.values()) {
					const lastPaidString = `on ${moment(data.date).format('MMM DD, YYYY')}`;
					lastPaidCache.contacts.set(data.did, lastPaidString);
				}
				return [...result.values()];
			}
		}
	}
	for (const data of result.values()) {
		const lastPaidString = `on ${moment(data.date).format('MMM DD, YYYY')}`;
		lastPaidCache.contacts.set(data.did, lastPaidString);
	}
	return [...result.values()];
}

export async function getLastPaidNetwork(auth: Auth, netVal?: string) {
	if (!auth.value?.did || !netVal) return 'Never';
	const cached = lastPaidCache.networks.get(netVal);
	let lastChecked = 0;
	let store: TransactionInter[] = get(vscTxsStore);
	let lastLength = 0;
	if (cached) return cached;

	do {
		store = get(vscTxsStore);
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			if (netVal.startsWith(tx.type)) {
				const lastPaidString = `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
				lastPaidCache.networks.set(netVal, lastPaidString);
				return lastPaidString;
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did);
		if (!success) {
			break;
		}
	} while (store.length > lastLength);
	lastPaidCache.networks.set(netVal, 'Never');
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
		return [SendAccount.swap];
	}
	let result = [SendAccount.vscAccount];
	if (did.startsWith('hive:')) {
		result.push(SendAccount.deposit);
	}
	return result;

	// let result: SendAccount[] = [];
	// if (!method) {
	// 	result = [SendAccount.vscAccount, SendAccount.swap];
	// } else {
	// 	if (method.value === TransferMethod.lightningTransfer.value) {
	// 		return [SendAccount.swap];
	// 	}
	// 	// let result = [SendAccount.vscAccount];
	// }
	// if (did.startsWith('hive:')) {
	// 	result.push(SendAccount.deposit);
	// }
	// return result;
}

type CoinOptList = CoinOptions['coins'][number];
export interface CoinOptionParam extends CoinOptList {
	disabled?: boolean;
	disabledMemo?: string;
}
export interface NetworkOptionParam extends Network {
	disabled?: boolean;
	disabledMemo?: string;
}
export interface AccountOptionParam extends SendAccount {
	disabled?: boolean;
	disabledMemo?: string;
}

type Constraints = {
	assetOptions: CoinOptionParam[];
	networkOptions: NetworkOptionParam[];
	accountOptions: AccountOptionParam[];
};

function createSet(arr: { value: string; [key: string]: any }[] | undefined) {
	if (!arr) {
		return new Set<string>();
	}
	return new Set(arr.map((item) => item.value));
}

function toNetworkArr(set: Set<string>) {
	return Object.values(Network).filter((net) => set.has(net.value));
}

function combineAssetOptions(
	all: Set<string>,
	from: Set<string>,
	to: Set<string>,
	toNetwork?: Network,
	fromNetwork?: Network
): CoinOptionParam[] {
	const allObjs = Object.values(swapOptions.from.coins);
	const available = from.intersection(to);
	const notInFrom = all.difference(from);
	const notInTo = all.difference(to).difference(notInFrom);
	let result: CoinOptionParam[] = Array.from(available)
		.map((val) => allObjs.find((coinOpt) => coinOpt.coin.value === val))
		.filter((item): item is CoinOptionParam => item !== undefined);
	for (const val of notInFrom) {
		const netObj = allObjs.find((coinOpt) => coinOpt.coin.value === val);
		if (netObj) {
			result.push({
				...netObj,
				disabled: true,
				disabledMemo: `Not available on ${fromNetwork ? 'network: ' + fromNetwork.label : 'potential source networks'}`
			});
		}
	}
	for (const val of notInTo) {
		const netObj = allObjs.find((coinOpt) => coinOpt.coin.value === val);
		if (netObj) {
			result.push({
				...netObj,
				disabled: true,
				disabledMemo: `Not available on recipient\'s network${toNetwork ? ': ' + toNetwork.label : ''}`
			});
		}
	}
	return result;
}

function combineNetworkOptions(
	all: Set<string>,
	from: Set<string>,
	did: string
): NetworkOptionParam[] {
	const allObjs = Object.values(Network);
	const notInFrom = all.difference(from);
	let result: NetworkOptionParam[] = Array.from(from)
		.map((val) => allObjs.find((net) => net.value === val))
		.filter((item): item is NetworkOptionParam => item !== undefined);
	for (const val of notInFrom) {
		const netObj = allObjs.find((net) => net.value === val);
		if (netObj) {
			result.push({
				...netObj,
				feeCalculation: undefined,
				disabled: true,
				disabledMemo: `Not available for ${did.startsWith('did:pkh:eip155:1:') ? 'EVM accounts' : 'your account type'}`
			});
		}
	}

	return result;
}

export function solveNetworkConstraints(
	method: TransferMethod | undefined,
	fromCoin: CoinOptions['coins'][number] | undefined,
	toNetwork: Network | undefined,
	did: string | undefined,
	account?: SendAccount,
	fromNetwork?: Network,
	allAssets: Boolean = false
): Constraints {
	// console.log("parameters to solve constraints", method, fromCoin, did, account);
	if (!did)
		return {
			assetOptions: [],
			accountOptions: [],
			networkOptions: []
		};
	const inUseNetworks = [Network.vsc, Network.hiveMainnet, Network.lightning];
	const allAccountsSet = createSet(Object.values(SendAccount));
	const allAssetsSet = createSet(swapOptions.from['coins'].map((item) => item.coin));
	const allNetworksSet = createSet(inUseNetworks);

	// given account: what are the network options
	// const availableAccounts = method
	// 	? createSet(getAccountsFromMethod(method, did))
	// 	: new Set(allAccountsSet);
	// if (accountOptions?.length === 1) {
	// 	account = accountOptions[0];
	// }
	const networksGivenMethod = createSet(method ? getMethodNetworks(method) : undefined);
	const networksGivenBoth = createSet(getDidNetworks(did)).intersection(networksGivenMethod);
	// const networkOptions = combineNetworkOptions(networksGivenMethod, networksGivenBoth, did);
	const networkOptions = combineNetworkOptions(networksGivenMethod, networksGivenMethod, did);
	// let accountNetworkOptions: Set<string> = method
	// 	? createSet(getMethodNetworks(method, did))
	// 	: createSet([Network.vsc, Network.hiveMainnet]);

	// if (account) {
	// 	const accountNetworks = createSet(getNetworksFromAccount(account, did) ?? []);
	// 	accountNetworkOptions = accountNetworkOptions.intersection(accountNetworks);
	// }

	// asset options based allowed on networks allowed by accounts
	const assetsGivenMethod = (() => {
		let result = new Set<string>();
		for (const net of method ? getMethodNetworks(method) : inUseNetworks) {
			const coins = networkMap.get(net.value);
			if (coins) {
				for (const coin of coins) {
					result.add(coin.value);
				}
			}
		}
		return result;
	})();
	const fromNetworkOptions: Network[] = fromNetwork ? [fromNetwork] : networkOptions;
	const assetsGivenFromNetworks = (() => {
		let result = new Set<string>();
		for (const net of fromNetworkOptions) {
			const coins = networkMap.get(net.value);
			if (coins) {
				for (const coin of coins) {
					result.add(coin.value);
				}
			}
		}
		return result;
	})();
	// keeps only coins that are also in the toNetwork
	const assetsGivenToNetwork = (() => {
		if (!toNetwork) return new Set<string>();
		const coinOpts = networkMap.get(toNetwork.value);
		if (!coinOpts) return new Set<string>();
		return createSet(coinOpts);
	})();

	let coinNetworkOptions: Set<string> = method
		? createSet(getMethodNetworks(method))
		: createSet(Object.values(Network));
	if (fromCoin) {
		const coinNetworks = createSet(fromCoin.networks);
		coinNetworkOptions = coinNetworkOptions.intersection(coinNetworks);
	}

	// const assetsDisabled =
	return {
		assetOptions: combineAssetOptions(
			allAssets ? allAssetsSet : assetsGivenMethod,
			assetsGivenFromNetworks,
			assetsGivenToNetwork,
			toNetwork,
			fromNetwork
		),
		accountOptions: [],
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
			new CoinAmount(amount, toCoin.coin),
			details.memo ? new URLSearchParams({ msg: details.memo }) : undefined
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
					memo: details.memo ?? ''
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
							memo: details.memo ?? '',
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
