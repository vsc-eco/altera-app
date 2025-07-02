import { getNonce, uint8ArrayToBase64Url } from '@vsc.eco/client/dist/utils';
import { submitTxQuery } from '@vsc.eco/client/dist/queries';
import Axios from 'axios';
import { encodePayload } from 'dag-jose-utils';
import { encode as encodeCborg } from './cborg_utils/encode';
import { decode as decodeCborg } from './cborg_utils/decode';
import { encode as encodeJson, decode as decodeJson } from '@ipld/dag-json';
import { ensureWalletConnection } from '$lib/auth/reown/reconnect';
import { getAccount } from '@wagmi/core';
import { wagmiConfig } from '$lib/auth/reown';
import { GetAccountNonceStore } from '$houdini';

export type Client = {
	api: string;
	userId: string;
	nonce: number | null;
	netId: 'vsc-mainnet';
};

export type TransferTransaction = {
	op: 'transfer';
	payload: {
		from: string;
		to: string;
		amount: string;
		asset: string;
	};
};

export type DepositTransaction = {
	op: 'deposit';
	payload: {
		from: string;
		to: string;
		amount: string;
		asset: string;
		memo?: string;
	};
};

export type WithdrawTransaction = {
	op: 'withdraw';
	payload: {
		from: string;
		to: string;
		amount: string;
		asset: string;
	};
};

export type StakeTransaction = {
	op: 'stake_hbd' | 'unstake_hbd';
	payload: {
		from: string;
		to: string;
		amount: string;
		asset: string;
		type: string;
	};
};

export type ConsensusStakeTransaction = {
	op: 'consensus_stake' | 'consensus_unstake';
	payload: {
		from: string;
		to: string;
		amount: string;
		asset: string;
		type: string;
	};
};

type Transaction =
	| TransferTransaction
	| WithdrawTransaction
	| StakeTransaction
	| ConsensusStakeTransaction
	| DepositTransaction;

export type VSCTransactionOp = {
	type: string;
	payload: Uint8Array; // CBOR-encoded payload
	required_auths: {
		active: string[];
		posting: string[];
	};
};

export interface VSCTransactionContainer {
	__t: 'vsc-tx';
	__v: '0.2';
	headers: {
		nonce: number;
		required_auths: string[];
		intents: [TransactionIntent, string][];
		type: TransactionDbType;
		rc_limit: number;
		net_id: string;
	};
	tx: VSCTransactionOp[];
}

// Signing shell with decoded payloads for display
export interface VSCTransactionSigningShell {
	__t: 'vsc-tx';
	__v: '0.2';
	headers: {
		nonce: number;
		required_auths: string[];
		rc_limit: number;
		net_id: string;
	};
	tx: {
		type: string;
		payload: string; // JSON string for display
	}[];
}

export type Signer<ExtraArgs extends any[] = []> = (
	signingShell: VSCTransactionSigningShell,
	client: Client,
	...signerArgs: ExtraArgs
) => SignedTransaction | Promise<SignedTransaction>;

export type Signature =
	| {
			t: 'eip191';
			s: string;
	  }
	| {
			alg: string;
			kid: string;
			sig: string;
	  };

export type SignedTransaction = {
	sigs: Signature[];
	rawTx: Uint8Array;
};

export type TransactionResult = {
	id: string;
};

export enum TransactionDbType {
	null,
	input,
	output,
	virtual,
	core,
	anchor_ref
}

export enum TransactionIntent {
	'money.spend' = 'money.spend'
}

export interface SignatureContainer {
	__t: 'vsc-sig';
	sigs: Signature[];
}

export function createClient(userId: string, api?: string): Client {
	return {
		api: api ?? 'https://api.vsc.eco',
		userId,
		nonce: null,
		netId: 'vsc-mainnet'
	};
}

// Create VSC transaction operation from high-level transaction
function createVSCTransactionOp(tx: Transaction, userId: string): VSCTransactionOp {
	if (tx.op === 'consensus_stake' || tx.op === 'consensus_unstake') {
		throw new Error(`Unsupported operation ${tx.op} on VSC Network.`);
	}

	const encodedPayload = encodeCborg(tx.payload);

	let requiredAuths = {
		active: [tx.payload.from],
		posting: []
	};

	// require to auth for stake/unstake
	if (tx.op === 'stake_hbd' || tx.op === 'unstake_hbd') {
		requiredAuths.active.push(tx.payload.to);
	}

	return {
		type: tx.op,
		payload: encodedPayload,
		required_auths: {
			active: [tx.payload.from],
			posting: []
		}
	};
}

function createVSCTransactionContainer(
	transactions: Transaction[],
	client: Client
): VSCTransactionContainer {
	const ops = transactions.map((tx) => createVSCTransactionOp(tx, client.userId));

	// Collect all required auths from operations
	const requiredAuthsSet = new Set<string>();
	ops.forEach((op) => {
		op.required_auths.active.forEach((auth) => requiredAuthsSet.add(auth));
		op.required_auths.posting.forEach((auth) => requiredAuthsSet.add(auth));
	});

	return {
		__t: 'vsc-tx',
		__v: '0.2',
		headers: {
			nonce: client.nonce!,
			required_auths: Array.from(requiredAuthsSet),
			intents: [],
			type: TransactionDbType.input,
			rc_limit: 500,
			net_id: client.netId
		},
		tx: ops
	};
}

function createSigningShell(txContainer: VSCTransactionContainer): VSCTransactionSigningShell {
	console.log("decoded cbor", decodeCborg(txContainer.tx[0].payload));
	console.log("reencoded dag json", encodeJson(decodeCborg(txContainer.tx[0].payload)));
	const decodedOps = txContainer.tx.map((op) => ({
		type: op.type,
		payload: Buffer.from(encodeJson(decodeCborg(op.payload))).toString('utf-8')
	}));

	return {
		__t: txContainer.__t,
		__v: txContainer.__v,
		headers: {
			nonce: txContainer.headers.nonce,
			required_auths: txContainer.headers.required_auths,
			rc_limit: txContainer.headers.rc_limit,
			net_id: txContainer.headers.net_id
		},
		tx: decodedOps
	};
}

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
	let binaryString = '';
	uint8Array.forEach((byte) => {
		binaryString += String.fromCharCode(byte);
	});

	return btoa(binaryString);
}

type TupleRemoveFirstTwoValues<T extends any[]> = T extends [any, any, ...infer Rest]
	? [...Rest]
	: [];

export async function signAndBrodcastTransaction<
	SigningFunc extends Signer<ExtraSignerArgs>,
	ExtraSignerArgs extends any[]
>(
	txs: Transaction[],
	signer: SigningFunc,
	client: Client,
	...signerArgs: TupleRemoveFirstTwoValues<Parameters<SigningFunc>>
): Promise<TransactionResult> {
	const walletConnected = await ensureWalletConnection();
	if (!walletConnected) {
		throw new Error(`wallet connection failed`);
	}

	if (client.nonce === null) {
		// client.nonce = await getNonce([client.userId], `${client.api}/api/v1/graphql`).catch((err) =>
		// 	console.log('error fetching nonce', err)
		// );
		const nonceStore = new GetAccountNonceStore;
		const res = await nonceStore.fetch({variables: {account: client.userId}})
		client.nonce = res.data?.getAccountNonce?.nonce ?? null;
	}

	if (!client.nonce) {
		throw new Error(`error fetching nonce`);
	}

	// Create the transaction container with CBOR-encoded payloads
	const txContainer = createVSCTransactionContainer(txs, client);

	// Create signing shell with decoded payloads for display
	const signingShell = createSigningShell(txContainer);

	const signedTx = await signer(
		signingShell,
		client,
		// @ts-ignore
		...signerArgs
	);

	const sigEncoded = uint8ArrayToBase64(
		(
			await encodePayload({
				__t: 'vsc-sig',
				sigs: signedTx.sigs
			})
		).linkedBlock
	);
	const txEncoded = uint8ArrayToBase64((await encodePayload(txContainer)).linkedBlock);

	const { data } = await Axios.post(`${client.api}/api/v1/graphql`, {
		query: submitTxQuery,
		variables: {
			tx: txEncoded,
			sig: sigEncoded
		}
	});
	console.log('axios response:', data);
	if (data?.data?.submitTransactionV1) {
		const submitResult = data.data.submitTransactionV1;
		client.nonce!++;
		console.log(submitResult);
		return {
			id: submitResult.id
		};
	}

	throw new Error(`vsc transaction failed: ${data.errors}`);
}

export type OnchainTransaction = Transaction;

export function getDepositTransaction(
	from: string,
	to: string,
	amount: string,
	asset: string,
	memo?: string
): DepositTransaction {
	return {
		op: 'deposit',
		payload: {
			from,
			to,
			amount,
			asset,
			memo
		}
	};
}

export type SubmittedTransaction = {
	id: string;
};

export type HiveSigner<
	ExtraJsonArgs extends any[] = [],
	ExtraTransferArgs extends any[] = ExtraJsonArgs
> = {
	json(
		auth: 'active' | 'posting',
		id: 'vsc.tx',
		tx: any,
		...signerArgs: ExtraJsonArgs
	): SubmittedTransaction | Promise<SubmittedTransaction>;
	transfer(
		tx: DepositTransaction,
		...signerArgs: ExtraTransferArgs
	): SubmittedTransaction | Promise<SubmittedTransaction>;
};

export async function signAndBrodcastTransactionToHive<
	HiveSignerInstance extends HiveSigner<ExtraJsonSignerArgs, ExtraTransferSignerArgs>,
	ExtraJsonSignerArgs extends any[],
	ExtraTransferSignerArgs extends any[],
	Tx extends OnchainTransaction
>(
	tx: Tx,
	signer: HiveSignerInstance,
	auth: 'active' | 'posting',
	client: Client,
	...signerArgs: TupleRemoveFirstTwoValues<
		Parameters<HiveSignerInstance[Tx['op'] extends 'deposit' ? 'transfer' : 'json']>
	>
): Promise<TransactionResult> {
	if (tx.op === 'deposit') {
		const res = await signer.transfer(
			tx,
			// @ts-ignore
			...signerArgs
		);
		return res;
	}

	const txContainer = createVSCTransactionContainer([tx], client);

	const res = await signer.json(
		auth,
		'vsc.tx',
		txContainer,
		// @ts-ignore
		...signerArgs
	);
	return res;
}
