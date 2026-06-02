/**
 * Reactive session wrapper around IsServiceClient. Owns the polling loop,
 * lifecycle, and Svelte 5 $state so consumers can bind to status text /
 * QR data without managing intervals themselves.
 *
 * Usage:
 *
 *   const session = createDashSession({ baseUrl, op: 'auth' });
 *   session.start();                       // returns when start() resolves
 *   // ... UI binds to session.state, session.start_response, etc.
 *   session.cancel();                      // tears down poll + tells server
 *
 * Polling is 2s, matching the IS service's dashd-watcher cadence; once
 * the state becomes terminal the loop self-stops.
 */
import {
	IsServiceClient,
	IsServiceError,
	isTerminal,
	type CallArgs,
	type IsOp,
	type IsSessionState,
	type SessionStartResponse,
	type SessionStatusResponse
} from './isClient';

const POLL_INTERVAL_MS = 2000;

export type DashSessionOpts = {
	baseUrl: string;
	op: IsOp;
	args?: CallArgs;
};

export type DashSessionState = {
	/** Last status the server reported. `undefined` until first poll lands. */
	readonly status: SessionStatusResponse | undefined;
	/** Response from session/start. Includes deposit address + QR data. */
	readonly startResponse: SessionStartResponse | undefined;
	/** Loading / error UI hook. */
	readonly phase: 'idle' | 'starting' | 'waiting' | 'done' | 'failed';
	/** Human-facing error message — populated alongside phase=failed. */
	readonly error: string | undefined;
	/** True when state machine reached a terminal state. */
	readonly terminal: boolean;
};

export type DashSession = DashSessionState & {
	begin(): Promise<void>;
	cancel(): Promise<void>;
};

export function createDashSession(opts: DashSessionOpts): DashSession {
	const client = new IsServiceClient(opts.baseUrl);

	let startResponse = $state<SessionStartResponse | undefined>(undefined);
	let status = $state<SessionStatusResponse | undefined>(undefined);
	let phase = $state<DashSessionState['phase']>('idle');
	let error = $state<string | undefined>(undefined);
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const terminal = $derived(status ? isTerminal(status.state) : false);

	function stopPolling() {
		if (pollTimer !== undefined) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	}

	async function poll(sid: string) {
		try {
			const next = await client.getStatus(sid);
			status = next;
			if (isTerminal(next.state)) {
				stopPolling();
				if (next.state === 'ON_CHAIN' && next.sessionToken) {
					phase = 'done';
				} else {
					phase = 'failed';
					// Round-3 audit R3-CSM-10: the server's forwardError
					// contains operator-language ('L2 reconcile timed
					// out — inspect chain state to recover' with a raw
					// l2TxId) — useless to a non-technical user. Prefer
					// the localized readableFailure mapping; surface the
					// raw forwardError only as a console.warn for ops.
					if (next.forwardError) {
						console.warn('IS session failed with operator detail:', next.forwardError);
					}
					error = readableFailure(next.state);
				}
			}
		} catch (e) {
			// Network blip is non-fatal — server's own TTL bounds the
			// session. Only escalate on a hard 4xx that says the session
			// is gone.
			if (e instanceof IsServiceError && (e.status === 404 || e.status === 410)) {
				stopPolling();
				phase = 'failed';
				error = 'session no longer available on the server';
			}
		}
	}

	async function begin(): Promise<void> {
		if (phase !== 'idle' && phase !== 'failed') return;
		phase = 'starting';
		error = undefined;
		try {
			const body: { op: IsOp; args?: CallArgs } = { op: opts.op };
			if (opts.op === 'call' && opts.args) body.args = opts.args;
			startResponse = await client.startSession(body);
			phase = 'waiting';
			pollTimer = setInterval(() => {
				if (startResponse) void poll(startResponse.sid);
			}, POLL_INTERVAL_MS);
			// Immediate first poll so the UI surfaces ATTESTING quickly
			// when the user paid before the modal even opened (rare but
			// possible — pre-cached deposit address).
			void poll(startResponse.sid);
		} catch (e) {
			phase = 'failed';
			error = e instanceof Error ? e.message : 'failed to start session';
		}
	}

	async function cancel(): Promise<void> {
		const sid = startResponse?.sid;
		const cancelToken = startResponse?.addressSignature;
		// Round-5 audit R5-002: don't pre-set phase='failed' before we
		// know whether the server can honour the cancel. If it returns
		// 409 (R4-003 in-flight refusal), the session is still
		// progressing toward a real terminal state and we keep polling
		// — destroying that flow here would lose a legitimate login.
		if (sid && cancelToken) {
			let outcome: 'cancelled' | 'in-flight-conflict' | 'error' = 'cancelled';
			try {
				outcome = await client.cancel(sid, cancelToken);
			} catch {
				outcome = 'error';
			}
			if (outcome === 'in-flight-conflict') {
				// Server is mid-attestation or mid-L2-submit; keep
				// polling so the user reaches a real terminal state.
				return;
			}
			if (outcome === 'error') {
				// Server may already have GC'd — surface the cancel
				// in the UI but don't poison the modal with an error.
			}
		}
		stopPolling();
		if (status && !isTerminal(status.state)) {
			phase = 'failed';
			error = 'cancelled';
		}
	}

	return {
		get status() {
			return status;
		},
		get startResponse() {
			return startResponse;
		},
		get phase() {
			return phase;
		},
		get error() {
			return error;
		},
		get terminal() {
			return terminal;
		},
		begin,
		cancel
	};
}

// readableFailure converts a server-side IS session state into a
// user-facing message. Round-3 audit R3-CSM-10 split the reconcile-
// related ForwardError variants out of the generic FORWARD_FAILED
// bucket because the server text is operator language (e.g. "L2
// reconcile timed out — inspect chain state to recover (l2TxId=...)").
//
// New states from D2-DESIGN-06 (L2_SUBMITTED + reconcile result) get
// mapped here so non-technical users see actionable copy.
function readableFailure(state: IsSessionState): string {
	switch (state) {
		case 'ATTESTATION_TIMEOUT':
			return 'Validator quorum was not reached in time. Please try again — if this persists, contact support.';
		case 'FORWARD_FAILED':
			return 'The on-chain step failed. Your Dash deposit will be available via the slow path; contact support to recover.';
		case 'EXPIRED':
			return 'The session expired before your InstantSend payment was observed.';
		case 'SLOW_PATH_PENDING':
			return 'Your payment is being processed via the slow path. This may take a few minutes.';
		default:
			return 'Sign-in failed. Please try again — if this persists, contact support.';
	}
}
