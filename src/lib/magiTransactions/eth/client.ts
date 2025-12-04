import { encodePayload } from 'dag-jose-utils';
import { encode as encodeCborg } from './cborg_utils/encode';
import { decode as decodeCborg } from './cborg_utils/decode';
import { encode as encodeJson } from '@ipld/dag-json';
import { ensureWalletConnection } from '$lib/auth/reown/reconnect';
import { GetAccountNonceStore, SubmitTransactionV1Store } from '$houdini';

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

export type CallContractTransaction = {
	op: 'call';
	payload: {
		contract_id: string;
		action: string;
		payload: string;
		rc_limit: number;
		// TODO: add support for intents
		intents: [];
		caller: string;
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
	| DepositTransaction
	| CallContractTransaction;

export type VSCTransactionOp = {
	type: string;
	payload: Uint8Array; // CBOR-encoded payload
};

export interface VSCTransactionContainer {
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
		payload: Uint8Array;
	}[];
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

export type Signature = {
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

	return {
		type: tx.op,
		payload: encodedPayload
	};
}

function createVSCTransactionContainer(
	transactions: Transaction[],
	client: Client
): VSCTransactionContainer {
	const ops = transactions.map((tx) => createVSCTransactionOp(tx, client.userId));

	// Collect all required auths from operations
	const requiredAuthsSet = new Set<string>();
	transactions.forEach((tx) => {
		if (tx.op === 'call') {
			requiredAuthsSet.add(tx.payload.caller);
		} else {
			requiredAuthsSet.add(tx.payload.from);
		}
	});

	return {
		__t: 'vsc-tx',
		__v: '0.2',
		headers: {
			nonce: client.nonce!,
			required_auths: Array.from(requiredAuthsSet),
			rc_limit: 500,
			net_id: client.netId
		},
		tx: ops.map((op) => ({
			type: op.type,
			payload: op.payload
		}))
	};
}

function createSigningShell(txContainer: VSCTransactionContainer): VSCTransactionSigningShell {
	const decodedOps = txContainer.tx.map((op) => ({
		type: op.type,
		payload: new TextDecoder().decode(encodeJson(decodeCborg(op.payload)))
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
	signal: AbortSignal | undefined,
	...signerArgs: TupleRemoveFirstTwoValues<Parameters<SigningFunc>>
): Promise<TransactionResult> {
	// console.log('start of signAndBroadcastTransaction() function');
	const walletConnected = await ensureWalletConnection();
	if (!walletConnected) {
		throw new Error(`wallet connection failed`);
	}

	// console.log('wallet connected', walletConnected);

	if (client.nonce === null) {
		const nonceStore = new GetAccountNonceStore();
		const res = await nonceStore.fetch({ variables: { account: client.userId } });
		client.nonce = res.data?.getAccountNonce?.nonce ?? null;
	}

	if (client.nonce === null) {
		throw new Error(`error fetching nonce`);
	}

	// Create the transaction container with CBOR-encoded payloads
	const txContainer = createVSCTransactionContainer(txs, client);

	// console.log('TX (txContainer) before encoding', txContainer);

	// Create signing shell with decoded payloads for display
	const signingShell = createSigningShell(txContainer);

	// console.log('signing shell:', signingShell);

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

	// console.log('sigEncoded', sigEncoded);
	// console.log('txEncoded', txEncoded);

	if (signal?.aborted) {
		throw new Error(`Transaction canceled by the user.`);
	}

	const response = await new SubmitTransactionV1Store().fetch({
		variables: {
			tx: txEncoded,
			sig: sigEncoded
		}
	});

	if (response?.data?.submitTransactionV1) {
		const submitResult = response.data.submitTransactionV1;
		if (!submitResult.id) {
			throw new Error(`No transaction ID found.`);
		}
		client.nonce!++;
		// console.log('submitResult', submitResult);
		return {
			id: submitResult.id
		};
	}

	throw new Error(`vsc transaction failed: ${response.errors ? response.errors[0].message : ''}`);
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
