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
	forwardError?: string;
	expiresAt: string;
};

const TERMINAL: ReadonlySet<IsSessionState> = new Set<IsSessionState>([
	'ON_CHAIN',
	'ATTESTATION_TIMEOUT',
	'FORWARD_FAILED',
	'EXPIRED'
]);

export function isTerminal(s: IsSessionState): boolean {
	return TERMINAL.has(s);
}

export class IsServiceError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'IsServiceError';
	}
}

export class IsServiceClient {
	constructor(private readonly baseUrl: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
	}

	async startSession(req: SessionStartRequest): Promise<SessionStartResponse> {
		const resp = await fetch(`${this.baseUrl}/session/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(req)
		});
		if (!resp.ok) throw await this.errFromResp(resp);
		return (await resp.json()) as SessionStartResponse;
	}

	async getStatus(sid: string): Promise<SessionStatusResponse> {
		const resp = await fetch(`${this.baseUrl}/session/${encodeURIComponent(sid)}/status`);
		if (!resp.ok) throw await this.errFromResp(resp);
		return (await resp.json()) as SessionStatusResponse;
	}

	/**
	 * Cancel the session. cancelToken is the addressSignature returned
	 * by /session/start — the server requires it via X-Cancel-Token
	 * (see handlers.go handleSessionCancel). Round-2 audit TC2-01
	 * caught the original token-less call returning 401 silently and
	 * leaking the watcher entry until TTL.
	 */
	async cancel(sid: string, cancelToken: string): Promise<void> {
		const resp = await fetch(`${this.baseUrl}/session/${encodeURIComponent(sid)}/cancel`, {
			method: 'POST',
			headers: { 'X-Cancel-Token': cancelToken }
		});
		// 204 No Content is the happy case; 404/401 are acceptable —
		// session already self-expired or never existed.
		if (!resp.ok && resp.status !== 404 && resp.status !== 401) {
			throw await this.errFromResp(resp);
		}
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
