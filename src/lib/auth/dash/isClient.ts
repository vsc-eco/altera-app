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

// Round-9 audit R9-SEC-01 + R9-SEC-02 / round-10 audit R10-CORR-01:
// a malicious / misbehaving IS service can stall any phase of the
// HTTP exchange — headers, body chunks, or a never-closed
// ReadableStream. The AbortController timer must outlive both the
// fetch() promise AND the body-parse step; clearing it after fetch
// alone (the R9 implementation) left a body-stream stall reopening
// the slow-loris DoS. fetchAndParse now wraps the timer around the
// entire request → parse cycle and only clears it after parse()
// resolves.
const FETCH_TIMEOUT_START_MS = 15_000;
const FETCH_TIMEOUT_STATUS_MS = 30_000;
const FETCH_TIMEOUT_CANCEL_MS = 30_000;

/**
 * fetchAndParse runs fetch() + a caller-supplied parse() step under a
 * single AbortController whose timer covers BOTH phases. When an
 * optional externalSignal is supplied (R10-CORR-ORPHAN-SESSION-01 —
 * so stop() can abort an in-flight startSession by aborting its own
 * controller), composition uses a manual addEventListener('abort',
 * onExternalAbort) → ctrl.abort() forwarder + paired
 * removeEventListener in the finally block.
 *
 * Round-12 audit R12-DRIFT-FETCHANDPARSE-DOCSTRING-ABORTSIGNALANY:
 * the docstring previously claimed AbortSignal.any composition but
 * the implementation has always used the manual listener pattern;
 * rewritten here to match. (AbortSignal.any would be cleaner but
 * still needs the timer-driven AbortController for the timeout
 * path, so the manual listener is no worse.)
 *
 * The pre-aborted-external-signal fast-path throws DOMException
 * synchronously instead of allocating a controller + timer that
 * would never be used — round-11 audit R11-INFO-FETCH-AND-PARSE-
 * EXT-SIGNAL-ALREADY-ABORTED.
 */
async function fetchAndParse<T>(
	input: RequestInfo,
	init: RequestInit,
	timeoutMs: number,
	parse: (resp: Response) => Promise<T>,
	externalSignal?: AbortSignal
): Promise<T> {
	// Pre-aborted external signal → reject synchronously instead of
	// wiring up an AbortController + setTimeout we'll never use.
	if (externalSignal?.aborted) {
		throw new DOMException('aborted', 'AbortError');
	}
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	const onExternalAbort = () => ctrl.abort();
	if (externalSignal) {
		externalSignal.addEventListener('abort', onExternalAbort);
	}
	try {
		const resp = await fetch(input, { ...init, signal: ctrl.signal });
		return await parse(resp);
	} finally {
		clearTimeout(t);
		if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
	}
}

export class IsServiceClient {
	constructor(private readonly baseUrl: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	/**
	 * startSession accepts an optional externalSignal so callers
	 * (session.svelte.ts) can abort an in-flight start when the
	 * component unmounts mid-flight — closes the R10-CORR-ORPHAN-
	 * SESSION-01 leak where stop() couldn't release the server
	 * record until the 30-min TTL.
	 */
	async startSession(req: SessionStartRequest, externalSignal?: AbortSignal): Promise<SessionStartResponse> {
		return fetchAndParse(
			`${this.baseUrl}/session/start`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(req)
			},
			FETCH_TIMEOUT_START_MS,
			async (resp) => {
				if (!resp.ok) throw await this.errFromResp(resp);
				const body = (await resp.json()) as unknown;
				// Round-12 audit R12-INFO-BEGIN-ORPHAN-MICRORACE-MISSING-DEFENSIVE-CHECK:
				// shape-check the response so a misbehaving server
				// can't return 200 with body=null / {} / missing
				// fields and slip past the TS `as` assertion.
				// session.svelte.ts uses sid + addressSignature as
				// the orphan-microrace cancel handle — a malformed
				// response would silently skip that cancel.
				if (
					!body ||
					typeof body !== 'object' ||
					typeof (body as Record<string, unknown>).sid !== 'string' ||
					typeof (body as Record<string, unknown>).addressSignature !== 'string'
				) {
					throw new IsServiceError(200, 'malformed /session/start response');
				}
				return body as SessionStartResponse;
			},
			externalSignal
		);
	}

	/**
	 * getStatus accepts an optional externalSignal. Round-11 audit
	 * R11-INFO-GETSTATUS-NO-EXTERNAL-SIGNAL: without this, an
	 * in-flight /status poll held the per-host socket for up to 30s
	 * after stop() — fast unmount/remount could queue new
	 * /session/start behind the previous /status.
	 */
	async getStatus(sid: string, externalSignal?: AbortSignal): Promise<SessionStatusResponse> {
		return fetchAndParse(
			`${this.baseUrl}/session/${encodeURIComponent(sid)}/status`,
			{},
			FETCH_TIMEOUT_STATUS_MS,
			async (resp) => {
				if (!resp.ok) throw await this.errFromResp(resp);
				return (await resp.json()) as SessionStatusResponse;
			},
			externalSignal
		);
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
		// Round-10 audit R10-CORR-01: route through fetchAndParse so
		// the AbortController also bounds the (typically empty) body
		// read. The cancel endpoint returns 204/401/404/409 with no
		// JSON body to parse, but a hostile server could still stall
		// on the Content-Length=0 read; fetchAndParse forces a single
		// timer to cover the entire exchange.
		let resp: Response;
		try {
			resp = await fetchAndParse(
				`${this.baseUrl}/session/${encodeURIComponent(sid)}/cancel`,
				{
					method: 'POST',
					headers: { 'X-Cancel-Token': cancelToken }
				},
				FETCH_TIMEOUT_CANCEL_MS,
				async (r) => r
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
		// Round-11 audit R11-INFO-CANCEL-401-MASKS-TOKEN-MISMATCH:
		// a 401 here is server-side "session not found OR bad token"
		// (server uses 401 for both — round-9 R9-INFO-EXISTENCE-
		// ORACLE-01 confirmed this is by design since /status already
		// leaks existence). Client-side, 401 may also indicate
		// X-Cancel-Token corruption (e.g. a token mutated before
		// it reached this call). Surface to console.debug so a
		// dev seeing repeated 401s can correlate, without changing
		// the user-visible behaviour (still treat as 'cancelled').
		if (resp.status === 401) {
			console.debug('Dash session cancel: 401 — server says session gone or token mismatch');
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
 * Address fingerprint — first 6 characters of the IS-service's
 * `addressSignature` (which is a base64-encoded Ed25519 / HMAC
 * signature, NOT hex), lowercased so the user-visible value is
 * stable regardless of case.
 *
 * Purpose: a session-internal visual identifier for the deposit
 * address — useful for a side-by-side check between this dialog
 * and the user's wallet after the QR is scanned, to catch an
 * obvious mid-flight QR swap.
 *
 * NOT a cryptographic credential: the value derives from
 * `addressSignature`, which is computed per /session/start over
 * a per-session sid. Every session produces a fresh signature →
 * a fresh fingerprint. There is no static value an operator
 * could publish out-of-band that the user could compare against.
 * The authentic-IS-service check is the SIGNATURE VERIFICATION
 * (verifyAddressSignature in signature.ts, SEC-2 hard-fails QR
 * render on `kind === 'invalid'`), NOT this fingerprint.
 *
 * Collision-space arithmetic (audit R18-SEC-altera-fingerprint-
 * collision-space-overstated + R18-CONS-fingerprint-collision-math-
 * 64-base-after-lowercase + R19-SEC-addressfingerprint-collision-
 * claim-misleads-on-attack-model): standard base64 has a 64-symbol
 * alphabet (A-Z + a-z + 0-9 + + + /). After `.toLowerCase()` the
 * uppercase + lowercase letters collapse to the same 26 letters,
 * shrinking the effective alphabet to ~38 distinct characters.
 * The 6-char prefix picks from ~38^6 ≈ 3.0e9 distinct values,
 * not 64^6 ≈ 68B.
 *
 * Attack model (R19): the relevant threat is PREIMAGE — an
 * attacker controlling a hostile IS-service who wants to match a
 * specific target fingerprint. With control of their own signing
 * key the attacker can grind sids offline at ~50ns/Ed25519-sign on
 * commodity hardware. 3B signs ≈ 150s wall-clock on one core,
 * trivially feasible. The fingerprint therefore provides ZERO
 * defense against an active adversary at the network level — its
 * sole purpose is the user-visible mid-flight QR-swap detection
 * described above. The 38^6 number is a property of the
 * representation, not a security guarantee.
 *
 * Audit R17-CONS-altera-addressfingerprint-not-actually-hex-or-hash:
 * the original "first 6 hex chars" wording was internally
 * contradictory — the signature is never hex on the wire.
 */
export function addressFingerprint(addressSignature: string): string {
	return (addressSignature || '').slice(0, 6).toLowerCase();
}
