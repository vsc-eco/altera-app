/**
 * Why a transaction failed.
 *
 * The transactions table only ever knew `status: FAILED` — the GraphQL
 * `TransactionRecord` carries no error field, and `findContractOutput` only
 * exposes `{ ok, ret }`, where `ret` is the empty string for a reverted call.
 * So the reason was only visible in a block explorer, which reads the raw
 * contract-output DAG.
 *
 * That DAG does carry it. `getDagByCID(<output cid>)` returns, for the node's
 * `ContractOutputResult` (modules/db/vsc/contracts/interface.go):
 *
 *   { "results": [{ "ok": false, "ret": "", "err": "ledger_error",
 *                   "errMsg": "insufficient balance" }],
 *     "inputs":  ["<txid>-<opIndex>"], ... }
 *
 * `errMsg` is the message the contract (or the ledger) produced; `err` is the
 * machine code. On a failed `call_contract` the state engine writes the revert
 * message into `errMsg` and leaves `ret` empty — which is exactly why the
 * GraphQL projection shows nothing.
 *
 * `inputs[i]` identifies which operation produced `results[i]`, using the
 * node's `MakeTxId`: the bare tx id for op 0, `<txid>-<opIndex>` after that.
 * A transaction reverts as a whole, so a deposit row can be FAILED because a
 * sibling swap op failed; `fromSiblingOp` marks that case so the UI can say so
 * instead of implying the deposit itself was rejected.
 */
import { DagByCIDStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';

/** A single entry of a contract output's `results` array. */
export type ContractOutputResult = {
	ok?: boolean;
	ret?: string;
	err?: string;
	errMsg?: string;
};

/** The parts of a `vsc-output` DAG node this module reads. */
export type ContractOutputDag = {
	inputs?: string[];
	results?: ContractOutputResult[];
};

/** A `TransactionRecord.output` entry: the output's CID plus the indices of
 *  the `results` entries that belong to the transaction we asked about. */
export type OutputRef = {
	id: string;
	index?: readonly number[] | null;
};

export type FailureReason = {
	/** The on-chain error message, shown verbatim. */
	message: string;
	/** Machine error code, e.g. `ledger_error`. */
	code?: string;
	/** False when `message` had to be derived from `code` because the chain
	 *  recorded no message. */
	hasMessage: boolean;
	/** True when the failing operation is a sibling in the same transaction
	 *  rather than the one this row shows. */
	fromSiblingOp: boolean;
};

/** The node's `MakeTxId`: op 0 is the bare tx id, later ops get a suffix. */
export function opInputId(txId: string, opIndex: number): string {
	return opIndex === 0 ? txId : `${txId}-${opIndex}`;
}

/** Readable stand-ins for the node's `ContractOutputError` codes, used only
 *  when the chain recorded a code but no message. */
const CODE_LABELS: Record<string, string> = {
	ledger_error: 'The ledger rejected the transfer.',
	ledger_intent_error: 'The ledger rejected the transfer intent.',
	gas_limit_hit: 'The call ran out of gas.',
	ic_recursion_limit_hit: 'The call hit the contract recursion limit.',
	ic_invalid_payload: 'The call payload was invalid.',
	ic_contract_not_found: 'The contract was not found.',
	ic_contract_get_error: 'The contract could not be loaded.',
	ic_code_fetch_error: 'The contract code could not be fetched.',
	ic_cid_decode_error: 'The contract CID could not be decoded.',
	missing_required_auth: 'A required authority was missing.',
	env_var_error: 'The contract environment was invalid.',
	runtime_abort: 'The contract aborted.',
	runtime_error: 'The contract hit a runtime error.',
	runtime_invalid: 'The contract is invalid.',
	sdk_error: 'The contract SDK returned an error.',
	wasm_init_error: 'The contract failed to start.',
	wasm_ret_error: 'The contract returned an invalid value.',
	wasm_function_not_found: 'The contract has no such action.',
	tss_key_not_found: 'The signing key was not found.',
	tss_key_duplicate: 'The signing key already exists.',
	unknown_error: 'The contract failed for an unknown reason.'
};

function labelForCode(code: string): string {
	return CODE_LABELS[code] ?? code.replace(/_/g, ' ');
}

function toReason(result: ContractOutputResult, fromSiblingOp: boolean): FailureReason {
	const code = typeof result.err === 'string' && result.err ? result.err : undefined;
	// `errMsg` is where a reverted call's message lands; `ret` is the
	// fallback for outputs that carry it there instead.
	const raw = (result.errMsg ?? '').trim() || (result.ret ?? '').trim();
	return {
		message: raw || (code ? labelForCode(code) : 'The transaction was reverted.'),
		code,
		hasMessage: raw.length > 0,
		fromSiblingOp
	};
}

/**
 * Pick the failure this row should report out of the transaction's contract
 * outputs. Prefers the row's own operation, and falls back to any other failed
 * operation of the same transaction (they all revert together).
 */
export function pickFailureReason(
	outputs: { ref: OutputRef; dag: ContractOutputDag | null }[],
	txId: string,
	opIndex: number
): FailureReason | null {
	const own = opInputId(txId, opIndex);
	let sibling: FailureReason | null = null;
	for (const { ref, dag } of outputs) {
		if (!dag) continue;
		const results = dag.results ?? [];
		const inputs = dag.inputs ?? [];
		// One output batches the results of several transactions; `index`
		// narrows them to ours. Without it, scan them all and filter by input.
		const indices = ref.index?.length ? ref.index : results.map((_, i) => i);
		for (const i of indices) {
			const result = results[i];
			if (!result || result.ok !== false) continue;
			const input = inputs[i];
			// Never report another transaction's error.
			if (input != null && input.split('-')[0] !== txId) continue;
			if (input == null || input === own) return toReason(result, false);
			sibling ??= toReason(result, true);
		}
	}
	return sibling;
}

/** `getDagByCID` is a JSON scalar: the node answers with a JSON *string*,
 *  while the generated types call it an object. Accept both. */
export function normalizeDag(raw: unknown): ContractOutputDag | null {
	let value = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	return value as ContractOutputDag;
}

/** DAG nodes are immutable (content-addressed), so one fetch per CID for the
 *  lifetime of the tab is enough — repeat hovers are free. */
const dagCache = new Map<string, Promise<ContractOutputDag | null>>();

function fetchDag(cid: string): Promise<ContractOutputDag | null> {
	const cached = dagCache.get(cid);
	if (cached) return cached;
	const pending = queryOnce(new DagByCIDStore(), {
		variables: { cid0: cid },
		policy: 'CacheOrNetwork'
	}).then((res) => normalizeDag(res.data?.d0));
	dagCache.set(cid, pending);
	// A failed fetch must not be remembered as the answer.
	pending.catch(() => dagCache.delete(cid));
	return pending;
}

/**
 * Fetch the on-chain reason a transaction's operation failed.
 *
 * Returns null when the chain recorded no contract output for it — a failure
 * outside contract execution leaves nothing to read.
 */
export async function loadFailureReason(
	txId: string,
	outputs: readonly (OutputRef | null | undefined)[] | null | undefined,
	opIndex: number
): Promise<FailureReason | null> {
	const refs = (outputs ?? []).filter((o): o is OutputRef => !!o?.id);
	if (refs.length === 0) return null;
	const resolved = await Promise.all(
		refs.map(async (ref) => ({ ref, dag: await fetchDag(ref.id) }))
	);
	return pickFailureReason(resolved, txId, opIndex);
}
