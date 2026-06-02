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
// Round-6 audit R6-SEC-01: bound how long we keep polling after a
// user-initiated cancel hit a 409 / network-error. A compromised IS
// service could respond with 409 to every cancel AND keep /status in
// non-terminal forever, trapping the user's modal. After this
// deadline the client force-fails the modal regardless of server
// state. The window covers the server's own reconcile budget
// (~180s) with margin so legitimate in-flight L2 reconciles still
// land before the trap-deadline kicks in.
const POST_CANCEL_DEADLINE_MS = 240_000;

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
	/**
	 * True after the user clicked cancel and the server refused with
	 * 409 (R4-003 in-flight) OR the cancel request errored. While
	 * this flag is set we keep polling until a real terminal state
	 * (or the R6-SEC-01 deadline). Useful for surfacing a 'finishing
	 * server-side step' banner in the modal.
	 */
	readonly postCancelConflict: boolean;
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
	// Round-6 audit R6-SEC-01: trap-deadline timer for post-cancel
	// polling. Set when the user clicks cancel and the server
	// refuses (409) or the cancel request errors; if the next
	// terminal state doesn't arrive within POST_CANCEL_DEADLINE_MS
	// the modal is force-failed so a misbehaving IS service can't
	// trap the user indefinitely.
	let postCancelDeadlineTimer: ReturnType<typeof setTimeout> | undefined;
	let postCancelConflict = $state(false);

	const terminal = $derived(status ? isTerminal(status.state) : false);

	function stopPolling() {
		if (pollTimer !== undefined) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
		if (postCancelDeadlineTimer !== undefined) {
			clearTimeout(postCancelDeadlineTimer);
			postCancelDeadlineTimer = undefined;
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
		//
		// Round-6 audit R6-CORR-04: a transient network/5xx error on
		// the cancel request shape this code as outcome='error'. The
		// pre-R6 implementation had an empty branch that fell through
		// to stopPolling()+phase='failed' — re-introducing R5-002 by
		// a different door. Treat 'error' the same as
		// 'in-flight-conflict': keep polling and let the next /status
		// poll reach the real terminal state on its own.
		if (sid && cancelToken) {
			let outcome: 'cancelled' | 'in-flight-conflict' | 'error' = 'cancelled';
			try {
				outcome = await client.cancel(sid, cancelToken);
			} catch {
				outcome = 'error';
			}
			if (outcome === 'in-flight-conflict' || outcome === 'error') {
				// Server is mid-attestation OR the cancel request
				// couldn't be confirmed. Keep polling so the user
				// reaches a real terminal state instead of seeing a
				// spurious 'failed' for a session that may still be
				// progressing. Round-6 R6-SEC-01: arm the
				// trap-deadline so a misbehaving server can't keep
				// /status in non-terminal forever.
				postCancelConflict = true;
				if (postCancelDeadlineTimer === undefined) {
					postCancelDeadlineTimer = setTimeout(() => {
						stopPolling();
						if (status && !isTerminal(status.state)) {
							phase = 'failed';
							error = 'cancel acknowledged but session did not finish on the server in time';
						}
					}, POST_CANCEL_DEADLINE_MS);
				}
				return;
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
		get postCancelConflict() {
			return postCancelConflict;
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
