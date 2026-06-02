/**
 * Client for the Magi IS-service HTTP API. Self-contained — no shared types
 * with the Go service yet (the Go side has no published TS types). Keep
 * `state` + `op` strings in sync with cmd/is-service/session.go and
 * cmd/is-service/handlers.go.
 *
 * Protocol summary:
 *
 *   POST /session/start   { op, args?, sid? }    → SessionStartResponse
 *   GET  /session/{sid}/status                   → SessionStatusResponse
 *   POST /session/{sid}/cancel                   → 204
 *
 * State arc: WAITING_FOR_IS → IS_OBSERVED → ATTESTING → ON_CHAIN
 *            (any state) → EXPIRED on TTL / cancel
 *            ATTESTATION_TIMEOUT / FORWARD_FAILED are terminal failure states.
 */

export type IsOp = 'auth' | 'call';

export type CallArgs = {
	contract: string;
	method: string;
	args: string;
	amount?: number;
};

export type SessionStartRequest = {
	op: IsOp;
	sid?: string;
	args?: CallArgs;
};

export type SessionStartResponse = {
	sid: string;
	depositAddress: string;
	depositInstructionHex: string;
	addressSignature: string;
	requiredAmountDuffs: number;
	expiresAt: string;
	statusUrl: string;
};

export type IsSessionState =
	| 'WAITING_FOR_IS'
	| 'IS_OBSERVED'
	| 'ATTESTING'
	// Round-4 audit R4-CSM-04: L2_SUBMITTED is non-terminal and is
	// emitted by the IS service during the reconcileL2 window (seconds
	// to minutes). Missing it previously left the humanState switch
	// rendering blank for the entire reconcile window.
	| 'L2_SUBMITTED'
	| 'ON_CHAIN'
	| 'ATTESTATION_TIMEOUT'
	| 'SLOW_PATH_PENDING'
	| 'FORWARD_FAILED'
	| 'EXPIRED';

export type SessionStatusResponse = {
	sid: string;
	state: IsSessionState;
	dashTxId?: string;
	/** Dash L1 address that paid the IS deposit. Populated from
	 * IS_OBSERVED onwards; absent until then. The IS-service derives it
	 * from the rawTx inputs (strict same-address-all-inputs rule per
	 * spec §5.2.5). */
	senderAddress?: string;
	forwardedAt?: string;
	sessionToken?: string;
	/** L2 mapInstantSendV2 transaction CID. Populated from L2_SUBMITTED
	 * onwards and preserved on terminal failure states so a frontend
	 * recovery flow can surface the L2-credited-but-session-lost case.
	 * Round-4 audit R4-006. */
	l2TxId?: string;
	forwardError?: string;
	expiresAt: string;
};

// Round-4 audit R4-SEC-03 extended Go session.go IsTerminal() to
// include AttestationTimeout AND SlowPathPending — both are terminal
// from the orchestrator's perspective (Drive returns after
// MutateState'ing into them). Round-5 audit R5-001 / R5-DRIFT-03
// caught the TS set lagging behind, which would have left the
// frontend polling forever past TTL for sessions the server already
// considered done.
const TERMINAL: ReadonlySet<IsSessionState> = new Set<IsSessionState>([
	'ON_CHAIN',
	'ATTESTATION_TIMEOUT',
	'SLOW_PATH_PENDING',
	'FORWARD_FAILED',
	'EXPIRED'
]);

export function isTerminal(s: IsSessionState): boolean {
	return TERMINAL.has(s);
}

/**
 * Outcomes of `cancel()`. Round-5 audit R5-002 introduced the
 * 'in-flight-conflict' branch (server returned 409 because the
 * orchestrator is mid-attestation or mid-L2-submit). Round-6 audit
 * R6-CORR-04 wired the session module to treat transient network /
 * 5xx errors equivalently. Round-7 audit R7-DRIFT-02 widened the
 * type so the discriminator is explicit at the type level and
 * downstream callers don't have to handle the catch separately.
 *
 * In all three cases the caller must NOT pre-set phase='failed';
 * the session module keeps polling /status until it reaches a
 * terminal state (bounded by POST_CANCEL_DEADLINE_MS).
 */
export type CancelResult = 'cancelled' | 'in-flight-conflict' | 'error';

export class IsServiceError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'IsServiceError';
	}
}

// Round-9 audit R9-SEC-01 + R9-SEC-02: a malicious / misbehaving IS
// service that accepts TCP then withholds the response body would
// previously keep the fetch promise pending indefinitely — pinning
// session.svelte.ts in cancelling=true (per R8-CORR-02 guard),
// piling concurrent /status polls past the browser per-host limit,
// or trapping startSession in phase='starting' forever. Every fetch
// in this client now runs with an AbortController so a hostile peer
// cannot prevent the timeout from firing client-side.
const FETCH_TIMEOUT_START_MS = 15_000;
const FETCH_TIMEOUT_STATUS_MS = 30_000;
const FETCH_TIMEOUT_CANCEL_MS = 30_000;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit, timeoutMs: number): Promise<Response> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(input, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(t);
	}
}

export class IsServiceClient {
	constructor(private readonly baseUrl: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	async startSession(req: SessionStartRequest): Promise<SessionStartResponse> {
		const resp = await fetchWithTimeout(`${this.baseUrl}/session/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(req)
		}, FETCH_TIMEOUT_START_MS);
		if (!resp.ok) throw await this.errFromResp(resp);
		return (await resp.json()) as SessionStartResponse;
	}

	async getStatus(sid: string): Promise<SessionStatusResponse> {
		const resp = await fetchWithTimeout(
			`${this.baseUrl}/session/${encodeURIComponent(sid)}/status`,
			{},
			FETCH_TIMEOUT_STATUS_MS
		);
		if (!resp.ok) throw await this.errFromResp(resp);
		return (await resp.json()) as SessionStatusResponse;
	}

	/**
	 * Cancel the session. cancelToken is the addressSignature returned
	 * by /session/start — the server requires it via X-Cancel-Token
	 * (see handlers.go handleSessionCancel). Round-2 audit TC2-01
	 * caught the original token-less call returning 401 silently and
	 * leaking the watcher entry until TTL.
	 *
	 * Round-9 audit R9-SEC-01: this fetch runs under an
	 * AbortController with a 30s timeout. An IS service that accepts
	 * TCP then never replies surfaces as 'error' (AbortError caught
	 * below) instead of pinning cancelling=true forever in
	 * session.svelte.ts.
	 */
	async cancel(sid: string, cancelToken: string): Promise<CancelResult> {
		let resp: Response;
		try {
			resp = await fetchWithTimeout(
				`${this.baseUrl}/session/${encodeURIComponent(sid)}/cancel`,
				{
					method: 'POST',
					headers: { 'X-Cancel-Token': cancelToken }
				},
				FETCH_TIMEOUT_CANCEL_MS
			);
		} catch {
			// Round-7 audit R7-DRIFT-02 / round-9 R9-SEC-01: catch
			// both network errors AND AbortController timeouts here
			// so the result type is the single source of truth.
			// Callers (session.svelte.ts cancel()) treat 'error' the
			// same as 'in-flight-conflict' — keep polling under the
			// R6-SEC-01 trap-deadline.
			return 'error';
		}
		// Round-5 audit R5-002 / R5-DRIFT-02: 409 Conflict is the
		// R4-003 in-flight refusal — the server is mid-attestation
		// or mid-L2-submit and cannot honour the cancel. Callers
		// must keep polling /status until terminal; pre-setting
		// phase='failed' on this branch destroys a legitimate
		// in-progress login.
		if (resp.status === 409) return 'in-flight-conflict';
		// 204 No Content is the happy case; 404/401 are acceptable —
		// session already self-expired or never existed.
		if (!resp.ok && resp.status !== 404 && resp.status !== 401) {
			// Treat any other non-OK (5xx, ...) as 'error' so the
			// caller falls into the same keep-polling branch as
			// the network-thrown case.
			return 'error';
		}
		return 'cancelled';
	}

	private async errFromResp(resp: Response): Promise<IsServiceError> {
		let msg = `${resp.status} ${resp.statusText}`;
		try {
			const body = (await resp.json()) as { error?: string };
			if (body?.error) msg = body.error;
		} catch {
			/* body wasn't JSON — fall back to status */
		}
		return new IsServiceError(resp.status, msg);
	}
}

/**
 * Build a BIP-21-style `dash:` URI suitable for DashPay's QR scanner.
 *
 * `IS=1` is an Altera convention: it hints to DashPay-compatible wallets
 * that this is meant to be sent as an InstantSend payment (not a standard
 * tx) so the wallet pre-selects the IS option.
 */
export function buildDashUri(address: string, amountDuffs: number): string {
	const dashAmount = (amountDuffs / 1e8).toFixed(8);
	return `dash:${address}?amount=${dashAmount}&IS=1`;
}

/**
 * Address fingerprint — first 6 hex chars of the IS-service's address
 * signature. Displayed alongside the QR so the user can spot a swapped
 * address even if the request was tampered with. Closes the visual
 * substitution vector, NOT the network-level one — for that the frontend
 * must verify `addressSignature` against a pinned IS-service pubkey
 * (todo: spec §5.7 HSM/KMS hand-off).
 */
export function addressFingerprint(addressSignature: string): string {
	return (addressSignature || '').slice(0, 6).toLowerCase();
}
