import { getAccounts } from '@aioha/aioha/build/rpc';
import { type Account, postingMetadataFromString } from '$lib/auth/hive/accountTypes';
import { getDidFromUsername, getUsernameFromAuth, getUsernameFromDid } from '$lib/getAccountName';
import swapOptions, {
	Coin,
	Network,
	networkMap,
	SendAccount,
	TransferMethod,
	type CoinOnNetwork,
	type CoinOptions,
	type IntermediaryNetwork,
	type NecessarySendDetails,
	type SendDetails
} from './sendOptions';
import { authStore, getAuth, type Auth } from '$lib/auth/store';
import {
	executeTx,
	getSendOpGenerator,
	getSendOpType,
	getSendOpGeneratorEnhanced
} from '$lib/magiTransactions/hive';
import {
	getEVMOpType,
	getEVMContractOpType,
	getEVMLiquidityPoolOp
} from '$lib/magiTransactions/eth';
import { getDexSwapCallOp } from '$lib/magiTransactions/hive';
import { CoinAmount } from '$lib/currency/CoinAmount';
import type { TransferOperation } from '@hiveio/dhive';
import { addLocalTransaction } from '../../stores/localStorageTxs';
import { createClient, signAndBrodcastTransaction } from '$lib/magiTransactions/eth/client';
import { wagmiSigner } from '$lib/magiTransactions/eth/wagmi';
import { wagmiConfig } from '$lib/auth/reown';
import { get, writable } from 'svelte/store';
import {
	fetchTxs,
	getTimestamp,
	magiTxsStore,
	waitForExtend,
	type TransactionInter
} from '$lib/stores/txStores';
import moment, { type Moment } from 'moment';
import { getIntermediaryNetwork } from './getNetwork';
import { validate, Network as BtcNetwork } from 'bitcoin-address-validation';
import {
	accountBalance,
	type AccountBalance,
	type HiveMainnetBalance
} from '$lib/stores/currentBalance';

export const SendTxDetails = writable<SendDetails>(blankDetails());

export function blankDetails(): SendDetails {
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

export function scanForBalance(opts: CoinOnNetwork[]): CoinOnNetwork | undefined {
	const accBal = get(accountBalance);
	for (const opt of opts) {
		if (opt.network.value === Network.magi.value) {
			const bal = accBal.bal[opt.coin.value as keyof AccountBalance];
			if (bal > 0) {
				return opt;
			}
		} else if (opt.network.value === Network.hiveMainnet.value && accBal.connectedBal) {
			const bal = accBal.connectedBal[opt.coin.value as keyof HiveMainnetBalance];
			if (bal > 0) {
				return opt;
			}
		}
	}
}

let tx_session_id = 0;

export function getTxSessionId() {
	return ++tx_session_id;
}

type ValidationError = {
	success: false;
	error: string;
};
type ValidationSuccess = {
	success: true;
	img?: string;
	displayName?: string;
};
type ValidationResult = ValidationSuccess | ValidationError;
export async function validateAddress(
	address: string,
	internalOnly = false
): Promise<ValidationResult> {
	if (address.length < 3) {
		return {
			success: false,
			error: 'Minimum address length is 3 characters'
		};
	} else if (address.length <= 16) {
		const accountInfo: Account = (await getAccounts([address])).result[0];
		if (accountInfo) {
			let displayName: string | undefined = undefined;
			if (accountInfo.posting_json_metadata) {
				const postingMetadata = postingMetadataFromString(
					accountInfo.posting_json_metadata
				).profile;
				displayName = postingMetadata['name'];
			}
			return {
				success: true,
				displayName: displayName
			};
		}
		return {
			success: false,
			error: 'No hive account found with this username'
		};
	} else if (address.length === 42 && address.startsWith('0x')) {
		return {
			success: true
		};
	} else if (validate(address, BtcNetwork.mainnet)) {
		if (internalOnly) {
			return {
				success: false,
				error: 'Bitcoin addresses may only be used for external transfers'
			};
		}
		return {
			success: true
		};
	}
	return {
		success: false,
		error: 'Address must be a Hive username, EVM address, or Bitcoin address'
	};
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
		return [Network.hiveMainnet, Network.magi];
	}
	if (did.startsWith('did:pkh:eip155:1:')) {
		return [
			Network.magi,
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
	if (method.value === TransferMethod.magiTransfer.value) {
		return [Network.magi, Network.hiveMainnet];
	}
	if (method.value === TransferMethod.lightningTransfer.value) {
		return [Network.lightning];
	}
	if (method.value === TransferMethod.magiLiquidityPoolSwap.value) {
		return [Network.magi];
	}
	return [];
}

function getDidNetworks(did: string) {
	let result = [Network.magi, Network.lightning];
	if (did.startsWith('hive:')) result.push(Network.hiveMainnet);
	return result;
}

const lastPaidCache: {
	contacts: Map<string, string | 'Never'>;
	networks: Map<string, string | 'Never'>;
	lastLength: number;
} = {
	contacts: new Map(),
	networks: new Map(),
	lastLength: 0
};
export function clearLastPaidCache() {
	lastPaidCache.contacts.clear();
	lastPaidCache.networks.clear();
}
export function momentToLastPaidString(lastPaid?: Moment | 'Never') {
	if (!lastPaid) return 'Never';
	return lastPaid === 'Never' ? lastPaid : `on ${lastPaid.format('MMM DD, YYYY')}`;
}
// increment through store, keep fetching more to find last paid
export async function getLastPaidContact(toDid: string): Promise<moment.Moment | 'Never'> {
	const auth = get(authStore);
	if (!auth.value?.did) return 'Never';
	const cached = lastPaidCache.contacts.get(toDid);
	if (cached) {
		if (cached === 'Never') return 'Never';
		return moment(cached);
	}
	let lastChecked = 0;
	let lastLength = 0;
	let store = get(magiTxsStore);
	let retries = 0;
	do {
		if (store.length <= lastLength) {
			retries++;
		} else {
			retries = 0;
		}
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (op?.data.to === toDid) {
					const date = getTimestamp(tx);
					const valid = isValidIsoDate(date);
					lastPaidCache.contacts.set(toDid, valid ? date : 'Never');
					return valid ? moment(date) : 'Never';
				}
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		await fetchTxs(auth.value.did, 'extend', undefined, 12);
		store = get(magiTxsStore);
	} while (store.length > lastLength && retries < 3);
	return 'Never';
}

export function isValidIsoDate(dateString: string): boolean {
	const date = new Date(dateString);
	const splitChars: RegExp = /[.Z]/;
	return !isNaN(date.getTime()) && date.toISOString().startsWith(dateString.split(splitChars)[0]);
}

// TODO: probably use a record instead, to filter by name but keep other data
export type RecipientData = {
	name?: string;
	did: string;
	date: string;
};
export async function getRecentContacts(auth: Auth): Promise<RecipientData[]> {
	if (!auth.value) return [];
	let result = new Map<string, RecipientData>();
	let leaveOut = ['v4vapp'];
	let lastChecked = 0;
	let lastLength = 0;
	let store: TransactionInter[] = get(magiTxsStore);
	do {
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (!op || op.data.from !== auth.value.did) continue;
				const username = getUsernameFromDid(op.data.to);
				if (!leaveOut.includes(username) && !result.has(username)) {
					result.set(username, {
						name: (await getDisplayName(op.data.to)) ?? undefined,
						did: op.data.to,
						date: getTimestamp(tx)
					});
				}
				if (result.size >= 3) {
					for (const data of result.values()) {
						lastPaidCache.contacts.set(data.did, isValidIsoDate(data.date) ? data.date : 'Never');
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
		store = get(magiTxsStore);
	} while (store.length > lastLength);

	for (const tx of store) {
		if (!tx.ops) continue;
		for (const op of tx.ops) {
			if (!op || !op.data.from) continue;
			const username = getUsernameFromDid(op.data.from);
			if (!leaveOut.includes(username) && !result.has(username)) {
				result.set(username, {
					name: (await getDisplayName(op.data.from)) ?? undefined,
					did: op.data.from,
					date: getTimestamp(tx)
				});
			}
			if (result.size >= 3) {
				for (const data of result.values()) {
					lastPaidCache.contacts.set(data.did, data.date);
				}
				return [...result.values()];
			}
		}
	}
	for (const data of result.values()) {
		const lastPaidMoment = moment(data.date);
		lastPaidCache.contacts.set(data.did, lastPaidMoment.toISOString());
	}
	return [...result.values()];
}

export async function getLastPaidNetwork(netVal?: string): Promise<moment.Moment | 'Never'> {
	const auth = get(authStore);
	if (!auth.value?.did || !netVal) return 'Never';
	const cached = lastPaidCache.networks.get(netVal);
	if (cached) {
		if (cached === 'Never') return 'Never';
		return moment(cached);
	}
	let lastChecked = 0;
	let store: TransactionInter[] = get(magiTxsStore);
	let lastLength = 0;

	do {
		lastLength = store.length;
		for (const tx of store.slice(lastChecked)) {
			if (!tx.ops) continue;
			if (netVal.startsWith(tx.type)) {
				const lastPaidMoment = moment(getTimestamp(tx));
				lastPaidCache.networks.set(netVal, lastPaidMoment.toISOString());
				return lastPaidMoment;
			}
		}
		lastChecked = Math.max(store.length - 1, 0);
		const success = await waitForExtend(auth.value.did);
		if (!success) {
			break;
		}
		store = get(magiTxsStore);
	} while (store.length > lastLength);
	lastPaidCache.networks.set(netVal, 'Never');
	return 'Never';
}

export async function getFee(toAmount: string) {
	const store = get(SendTxDetails);

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
	if (method.value === TransferMethod.magiTransfer.value) {
		const result: AccsNetsPair = { accounts: [SendAccount.magiAccount] };
		if (did.startsWith('hive:')) {
			result.accounts!.push(SendAccount.deposit);
			result.networks = [Network.hiveMainnet];
		}
		return result;
	}
	if (method.value === TransferMethod.lightningTransfer.value) {
		return {
			accounts: [SendAccount.swap],
			networks: [Network.lightning]
		};
	}
	if (method.value === TransferMethod.magiLiquidityPoolSwap.value) {
		return {
			accounts: [SendAccount.magiAccount],
			networks: [Network.magi]
		};
	}
	return;
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
};

export function optionsEqual<T>(
	a: (CoinOptionParam | AccountOptionParam | NetworkOptionParam)[],
	b: (CoinOptionParam | AccountOptionParam | NetworkOptionParam)[]
): boolean {
	if (a.length !== b.length) return false;

	const getValue = (item: CoinOptionParam | AccountOptionParam | NetworkOptionParam) =>
		'coin' in item ? item.coin.value : item.value;

	return a.every(
		(val, i) =>
			getValue(val) === getValue(b[i]) &&
			val.disabled === b[i].disabled &&
			val.disabledMemo === b[i].disabledMemo
	);
}

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
	to?: Set<string>,
	toNetwork?: Network,
	fromNetwork?: Network
): CoinOptionParam[] {
	const allObjs = Object.values(swapOptions.from.coins);
	const available = to ? from.intersection(to) : from;
	const notInFrom = all.difference(from);
	const notInTo = to ? all.difference(to).difference(notInFrom) : new Set<string>();
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
	fromNetwork?: Network,
	allAssets: Boolean = false
): Constraints {
	// console.log("parameters to solve constraints", method, fromCoin, did, account);
	if (!did)
		return {
			assetOptions: [],
			networkOptions: []
		};
	const inUseNetworks = [Network.magi, Network.hiveMainnet, Network.lightning];
	const allAssetsSet = createSet(swapOptions.from['coins'].map((item) => item.coin));

	const networksGivenMethod = createSet(method ? getMethodNetworks(method) : undefined);
	const networksGivenBoth = createSet(getDidNetworks(did)).intersection(networksGivenMethod);
	const networkOptions = combineNetworkOptions(networksGivenMethod, networksGivenMethod, did);

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

	return {
		assetOptions: combineAssetOptions(
			allAssets ? allAssetsSet : assetsGivenMethod,
			assetsGivenFromNetworks,
			method?.value === TransferMethod.lightningTransfer.value ? undefined : assetsGivenToNetwork,
			toNetwork,
			fromNetwork
		),
		networkOptions: networkOptions
	};
}

export function solveToNetworks(): Network[] {
	const txDetails = get(SendTxDetails);
	const recipientNetworks: Network[] | undefined = txDetails.toUsername
		? getRecipientNetworks(getDidFromUsername(txDetails.toUsername)).filter((net) => !net.disabled)
		: undefined;
	const coinNetworks =
		txDetails.fromNetwork && txDetails.fromCoin ? txDetails.fromCoin.networks : undefined;
	const intersection =
		recipientNetworks && coinNetworks
			? coinNetworks.filter((net) =>
					recipientNetworks.map((rnet) => rnet.value).includes(net.value)
				)
			: (recipientNetworks ?? coinNetworks ?? []);
	if (getUsernameFromAuth(getAuth()()) === txDetails.toUsername) {
		return intersection.filter((net) => net.value !== txDetails.fromNetwork?.value);
	} else {
		return intersection;
	}
}

/**
 * LIQUIDITY POOL OPERATIONS INTEGRATION
 * 
 * The send pipeline now supports liquidity pool operations (addLiquidity, removeLiquidity)
 * in addition to standard transfers. These operations flow through both authentication paths:
 * 
 * 1. Hive Auth Flow (via aioha):
 *    - LP operations call getSendOpGeneratorEnhanced() with operationType + operationParams
 *    - Returns a CustomJsonOperation that can be broadcast via executeTx()
 * 
 * 2. EVM Wallet Flow (via Reown/Rion to VSC Magi):
 *    - LP operations call getEVMLiquidityPoolOp() directly
 *    - Returns a CallContractTransaction that posts to VSC
 * 
 * To support LP operations from the UI, extend SendDetails to include:
 *   - operationType?: 'addLiquidity' | 'removeLiquidity'
 *   - lpParams?: Record<string, unknown> (dexContractId, amounts, etc.)
 */

/**
 * Helper to determine if a send operation is a liquidity pool operation
 */
function isLiquidityPoolOperation(
	operationType?: string,
	operationParams?: Record<string, unknown>
): boolean {
	return (
		(operationType === 'addLiquidity' || operationType === 'removeLiquidity') &&
		operationParams !== undefined
	);
}

/**
 * Helper to determine if send is a DEX swap (router execute) operation
 */
function isDexSwapOperation(
	method: { value?: string; isSwap?: boolean } | undefined,
	swapParams: Record<string, unknown> | undefined
): boolean {
	return (method?.isSwap || method?.value === 'magi-liquidity-pool-swap') && !!swapParams;
}

/**
 * Execute DEX swap via EVM wallet (router-v2 execute)
 */
async function executeDexSwapEVM(
	auth: Auth,
	swapParams: Record<string, unknown>,
	setStatus: (msg: string, isError?: boolean) => void,
	signal?: AbortSignal
): Promise<Error | { id: string }> {
	if (auth.value?.provider !== 'reown' || !auth.value?.did) {
		return new Error('EVM wallet (Reown) required for swap');
	}
	try {
		setStatus('Preparing router transaction for signing…');
		const swapTx = getEVMOpType(
			Network.magi,
			Network.magi,
			auth.value.did,
			'',
			new CoinAmount('0', Coin.hive),
			'dex-swap',
			swapParams
		);
		const client = createClient(auth.value.did);
		const result = await signAndBrodcastTransaction(
			[swapTx],
			wagmiSigner,
			client,
			signal,
			wagmiConfig
		);
		setStatus('Transaction submitted successfully!');
		return { id: result.id };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		setStatus(message, true);
		return new Error(message);
	}
}

/**
 * Execute DEX swap via Hive auth (router-v2 execute)
 */
async function executeDexSwapHive(
	auth: Auth,
	swapParams: Record<string, unknown>,
	setStatus: (msg: string, isError?: boolean) => void
): Promise<Error | { id: string }> {
	if (!auth.value?.aioha || !auth.value?.username) {
		return new Error('Hive wallet required for swap');
	}
	try {
		setStatus('Waiting for Hive wallet approval…');
		const { routerV2ContractId, instruction, amountIn } = swapParams as {
			routerV2ContractId?: string;
			instruction?: Record<string, unknown>;
			amountIn?: number;
		};
		if (!routerV2ContractId || !instruction || amountIn === undefined) {
			return new Error('Missing swap parameters');
		}
		const op = getDexSwapCallOp(
			auth.value.username,
			routerV2ContractId,
			instruction as any,
			amountIn
		);
		const res = await executeTx(auth.value.aioha, [op]);
		if (res.success) {
			setStatus('Transaction submitted. You will be notified when your transaction is finished.');
			return { id: res.result };
		}
		setStatus(res.error ?? 'Unknown error', true);
		return new Error(res.error ?? 'Unknown error');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		setStatus(message, true);
		return new Error(message);
	}
}

/**
 * Execute Magi transfer via EVM wallet
 */
async function executeMagiTransferEVM(
	auth: Auth,
	details: NecessarySendDetails,
	setStatus: (msg: string, isError?: boolean) => void,
	signal?: AbortSignal
): Promise<Error | { id: string }> {
	if (auth.value?.provider !== 'reown' || !auth.value?.did) {
		return new Error("VSC Transactions via an EVM wallet aren't supported yet.");
	}
	const client = createClient(auth.value.did);
	const sendOp = getEVMOpType(
		details.fromNetwork,
		details.toNetwork,
		auth.value.did,
		getDidFromUsername(details.toUsername),
		new CoinAmount(details.amount, details.toCoin.coin)
	);
	setStatus('Preparing transaction for signing…');
	const id = await signAndBrodcastTransaction(
		[sendOp],
		wagmiSigner,
		client,
		signal,
		wagmiConfig
	)
		.then((result) => {
			setStatus('Transaction submitted successfully!');
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

/**
 * Execute Magi transfer via Hive auth
 */
async function executeMagiTransferHive(
	auth: Auth,
	details: NecessarySendDetails,
	setStatus: (msg: string, isError?: boolean) => void
): Promise<Error | { id: string }> {
	if (!auth.value?.aioha || !auth.value?.username) {
		return new Error("VSC Transactions via an EVM wallet aren't supported yet.");
	}
	const getSendOp = getSendOpGenerator(
		details.fromNetwork,
		details.toNetwork,
		details.toCoin.coin
	);
	const opType = getSendOpType(details.fromNetwork, details.toNetwork);
	setStatus('Waiting for Hive wallet approval…');
	const sendOp = getSendOp(
		auth.value.username,
		getDidFromUsername(details.toUsername),
		new CoinAmount(details.amount, details.toCoin.coin),
		details.memo ? new URLSearchParams({ msg: details.memo }) : undefined
	);
	const res = await executeTx(auth.value.aioha, [sendOp]);
	if (res.success) {
		setStatus('Transaction submitted. You will be notified when your transaction is finished.');
		addLocalTransaction({
			ops: [
				{
					data: {
						amount: new CoinAmount(details.amount, details.toCoin.coin).toAmountString(),
						asset: details.toCoin.coin.unit.toLowerCase(),
						from: auth.value.did,
						to: getDidFromUsername(details.toUsername),
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
	setStatus(res.error ?? 'Unknown error', true);
	return new Error(res.error ?? 'Unknown error');
}

/**
 * Execute Hive mainnet transfer (direct Hive chain)
 */
async function executeHiveMainnetTransfer(
	auth: Auth,
	details: NecessarySendDetails,
	setStatus: (msg: string, isError?: boolean) => void
): Promise<Error | { id: string }> {
	if (!auth.value?.aioha || !auth.value?.username) {
		return new Error("Hive Mainnet Transactions via an EVM wallet aren't supported yet.");
	}
	setStatus('Waiting for Hive wallet approval…');
	const toCoinAmount = new CoinAmount(details.amount, details.toCoin.coin);
	const res = await executeTx(auth.value.aioha, [
		[
			'transfer',
			{
				from: auth.value.username,
				to: details.toUsername,
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
						amount: new CoinAmount(details.amount, details.toCoin.coin).toAmountString(),
						asset: details.toCoin.coin.unit.toLowerCase(),
						from: auth.value.did,
						to: getDidFromUsername(details.toUsername),
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
	return new Error(res.error ?? 'Unknown error');
}

/**
 * Execute a liquidity pool operation via Hive auth
 */
async function executeLPOperationHive(
	auth: Auth,
	operationType: string,
	operationParams: Record<string, unknown>,
	setStatus: (msg: string, isError?: boolean) => void
): Promise<Error | { id: string }> {
	if (!auth.value?.aioha) {
		return new Error('Hive wallet required for liquidity pool operations');
	}

	try {
		setStatus('Waiting for Hive wallet approval…');

		const getSendOp = getSendOpGeneratorEnhanced(
			Network.magi,
			Network.magi,
			undefined,
			operationType,
			operationParams
		);

		if (!getSendOp) {
			return new Error(`Unknown LP operation type: ${operationType}`);
		}

		const lpOp = getSendOp(auth.value.username!, '', new CoinAmount('0', Coin.hive), undefined);
		const res = await executeTx(auth.value.aioha, [lpOp]);

		if (res.success) {
			setStatus('Transaction submitted. You will be notified when your transaction is finished.');
			return { id: res.result };
		}
		setStatus(res.error, true);
		return new Error(res.error);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setStatus(message, true);
		return new Error(message);
	}
}

/**
 * Execute a liquidity pool operation via EVM wallet
 */
async function executeLPOperationEVM(
	auth: Auth,
	operationType: string,
	operationParams: Record<string, unknown>,
	setStatus: (msg: string, isError?: boolean) => void,
	signal?: AbortSignal
): Promise<Error | { id: string }> {
	if (auth.value?.provider !== 'reown' || !auth.value?.did) {
		return new Error('EVM wallet (Reown) required for this operation');
	}

	try {
		setStatus('Preparing transaction for signing…');

		const lpTx = getEVMLiquidityPoolOp(auth.value.did, operationType as any, operationParams);
		const client = createClient(auth.value.did);

		const result = await signAndBrodcastTransaction([lpTx], wagmiSigner, client, signal, wagmiConfig)
			.then((result) => {
				setStatus('Transaction submitted successfully!');
				return result;
			})
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				setStatus(message, true);
				throw new Error(message);
			});

		return { id: result.id };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setStatus(message, true);
		return new Error(message);
	}
}

export async function send(
	details: NecessarySendDetails,
	auth: Auth,
	intermediary: IntermediaryNetwork,
	setStatus: (status: string, isError?: boolean) => void,
	signal?: AbortSignal | undefined
): Promise<Error | { id: string }> {
	const operationType = details.operationType;
	const operationParams = details.lpParams ?? details.swapParams;
	const method = details.method;
	const swapParams = details.swapParams;

	// 1. LP add/remove operations (Magi only)
	if (isLiquidityPoolOperation(operationType, operationParams)) {
		if (intermediary !== Network.magi) {
			return new Error('Liquidity pool operations are only supported on Magi network');
		}
		if (auth.value?.provider === 'reown') {
			return executeLPOperationEVM(auth, operationType!, operationParams!, setStatus, signal);
		}
		if (auth.value?.aioha) {
			return executeLPOperationHive(auth, operationType!, operationParams!, setStatus);
		}
		return new Error('Hive or EVM wallet required for liquidity pool operations');
	}

	// 2. DEX swap operations (router execute, Magi only)
	if (isDexSwapOperation(method, swapParams)) {
		if (intermediary !== Network.magi) {
			return new Error('DEX swap operations are only supported on Magi network');
		}
		if (auth.value?.provider === 'reown') {
			return executeDexSwapEVM(auth, swapParams!, setStatus, signal);
		}
		if (auth.value?.aioha) {
			return executeDexSwapHive(auth, swapParams!, setStatus);
		}
		return new Error('Hive or EVM wallet required for DEX swap');
	}

	// 3. Magi transfers (deposit, withdraw, internal transfer)
	if (intermediary === Network.magi) {
		if (auth.value?.provider === 'reown') {
			return executeMagiTransferEVM(auth, details, setStatus, signal);
		}
		if (auth.value?.aioha) {
			return executeMagiTransferHive(auth, details, setStatus);
		}
		return new Error("VSC Transactions via an EVM wallet aren't supported yet.");
	}

	// 4. Hive mainnet transfers
	if (intermediary === Network.hiveMainnet) {
		return executeHiveMainnetTransfer(auth, details, setStatus);
	}

	return new Error('Unexpected Error: Unsupported transaction.');
}
