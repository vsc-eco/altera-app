/**
 * Reactive session wrapper around IsServiceClient. Owns the polling
 * loop, lifecycle, and Svelte 5 $state so consumers can bind to
 * status text / QR data without managing intervals themselves.
 *
 * Usage (round-9 audit R9-DRIFT-DOC-USAGE-01 — pre-R9 the docstring
 * referenced session.start() / session.state / session.start_response
 * which do not exist; the real names are begin/phase/startResponse,
 * and stop() is the synchronous-teardown path that onDestroy must
 * call):
 *
 *   const session = createDashSession({ baseUrl, op: 'auth' });
 *   await session.begin();                 // POST /session/start
 *   // UI binds to session.phase / session.startResponse / session.status
 *
 *   await session.cancel();                // user-initiated; tells
 *                                          // server; may keep polling
 *                                          // on 409 in-flight refusal
 *
 *   onDestroy(() => session.stop());       // synchronous teardown —
 *                                          // sets destroyed=true,
 *                                          // clears poll + trap-
 *                                          // deadline timers, and
 *                                          // fire-and-forgets a
 *                                          // server-side /cancel
 *
 * Polling cadence is 2s (matches the IS service's dashd-watcher);
 * once the state becomes terminal the loop self-stops. cancel() and
 * begin() are no-ops after stop(); the `destroyed` flag is private.
 *
 * Cross-references: R6-SEC-01 trap-deadline (240s); R8-CORR-02
 * stop/cancel split; R9-SEC-01 AbortController timeouts in isClient.
 */
import {
	IsServiceClient,
	IsServiceError,
	isTerminal,
	type CallArgs,
	type CancelResult,
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
	/**
	 * Synchronous teardown — clears the poll interval and the R6-SEC-01
	 * trap-deadline timer immediately, marks the session destroyed,
	 * and (if a sid is known) issues a best-effort fire-and-forget
	 * server-side cancel so the server's session record is released.
	 * Safe to call from Svelte's onDestroy hook. Round-8 audit
	 * R8-CORR-02: the previous onDestroy(() => cancel()) path leaked
	 * pollTimer + 240s deadline on the 409/error branches because
	 * cancel() intentionally skipped stopPolling in those cases.
	 */
	stop(): void;
};

export function createDashSession(opts: DashSessionOpts): DashSession {
	const client = new IsServiceClient(opts.baseUrl);

	let startResponse = $state<SessionStartResponse | undefined>(undefined);
	let status = $state<SessionStatusResponse | undefined>(undefined);
	let phase = $state<DashSessionState['phase']>('idle');
	let error = $state<string | undefined>(undefined);
	// Round-10 audit R10-OPS-POLL-OVERLAP-01: replaced the setInterval
	// pattern with a recursive setTimeout that re-schedules ONLY after
	// the previous poll resolves/aborts. Pre-R10 setInterval(2s) could
	// stack ~15 concurrent /status fetches against a stalling server
	// before the AbortController timeouts fired (browser per-host
	// limit gates further). The new shape naturally bounds in-flight
	// /status to 1, freeing other sockets for cancel/start.
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	// pollGen bumps on each stopPolling so an in-flight tick whose
	// re-schedule would otherwise race past clearTimeout cancels itself
	// after its await resolves. Solves the schedulePoll-vs-stopPolling
	// re-arm race.
	let pollGen = 0;
	// Round-6 audit R6-SEC-01: trap-deadline timer for post-cancel
	// polling. Set when the user clicks cancel and the server
	// refuses (409) or the cancel request errors; if the next
	// terminal state doesn't arrive within POST_CANCEL_DEADLINE_MS
	// the modal is force-failed so a misbehaving IS service can't
	// trap the user indefinitely.
	let postCancelDeadlineTimer: ReturnType<typeof setTimeout> | undefined;
	let postCancelConflict = $state(false);
	// Round-8 audit R8-CORR-02: destroyed gate. Once stop() runs,
	// poll() / cancel() / begin() must NOT re-arm any timer or write
	// to $state cells. Solves the begin()/onDestroy race (start was
	// in-flight at unmount → resolves after with a fresh
	// setInterval) and the 409/error-branch leak (cancel returned
	// early without stopPolling).
	let destroyed = false
	// Round-8 audit R8-INFO-02 + R8-DESIGN-02: concurrency guard for
	// cancel(). The modal has three cancel call-sites (onDestroy,
	// $effect open=false, retry()). Without this flag, a 409 from
	// the first cancel can cascade into a second cancel arming a
	// fresh 240s timer after the first stopPolling has already
	// cleared it.
	let cancelling = false
	// Round-10 audit R10-CORR-ORPHAN-SESSION-01: track the
	// AbortController for an in-flight POST /session/start so stop()
	// can cancel the request itself. Without this, a user who
	// unmounts the modal between session/start being submitted and
	// resolved leaks the server-side session for the full 30-min
	// TTL — the R9-DESIGN-STOP-NOCANCEL-01 fire-and-forget /cancel
	// couldn't fire because we had no sid yet.
	let startAbort: AbortController | undefined

	const terminal = $derived(status ? isTerminal(status.state) : false);

	function stopPolling() {
		// Bump the generation so any in-flight tick declines to
		// re-arm itself after its await resolves.
		pollGen++;
		if (pollTimer !== undefined) {
			clearTimeout(pollTimer);
			pollTimer = undefined;
		}
		if (postCancelDeadlineTimer !== undefined) {
			clearTimeout(postCancelDeadlineTimer);
			postCancelDeadlineTimer = undefined;
		}
		// Round-8 audit R8-CORR-01: clearing the post-cancel timer
		// without resetting the banner left postCancelConflict stuck
		// true whenever the poll loop reached a real terminal state
		// before the deadline fired.
		postCancelConflict = false;
	}

	// schedulePoll: recursive setTimeout that runs one poll, then
	// schedules the next AFTER it resolves/aborts. Round-10 audit
	// R10-OPS-POLL-OVERLAP-01 replaced setInterval with this shape
	// so we never have more than one /status fetch in flight. The
	// pollGen check inside tick guarantees a stopPolling that lands
	// between tick start and tick end cancels the re-arm.
	function schedulePoll() {
		if (destroyed || !startResponse) return;
		const sid = startResponse.sid;
		const gen = ++pollGen;
		const tick = async () => {
			if (destroyed || gen !== pollGen) return;
			await poll(sid);
			if (destroyed || gen !== pollGen) return;
			pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
		};
		// Immediate first poll so phase=='waiting' flips quickly
		// when the user paid before the modal opened (rare but
		// possible — pre-cached deposit address).
		pollTimer = setTimeout(tick, 0);
	}

	async function poll(sid: string) {
		if (destroyed) return;
		try {
			const next = await client.getStatus(sid);
			if (destroyed) return;
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
			// Round-9 audit R9-CORR-01a: respect the destroyed gate
			// here too. Without this guard a /status fetch that
			// rejects (e.g. 404 after stop() races a Prune) would
			// write to $state on an unmounted component.
			if (destroyed) return;
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
		if (destroyed) return;
		if (phase !== 'idle' && phase !== 'failed') return;
		phase = 'starting';
		error = undefined;
		// Round-10 audit R10-CORR-ORPHAN-SESSION-01: hand stop() a
		// handle on the in-flight start so it can abort if the user
		// unmounts before the server returns. Cleared in the
		// finally branch below.
		startAbort = new AbortController();
		try {
			const body: { op: IsOp; args?: CallArgs } = { op: opts.op };
			if (opts.op === 'call' && opts.args) body.args = opts.args;
			const sr = await client.startSession(body, startAbort.signal);
			// Round-8 audit R8-CORR-02: stop() may have run while the
			// fetch was in flight. If so, bail before arming pollTimer
			// (which would otherwise write to $state for the full
			// server TTL on a destroyed component).
			if (destroyed) return;
			startResponse = sr;
			phase = 'waiting';
			schedulePoll();
		} catch (e) {
			if (destroyed) return;
			phase = 'failed';
			error = e instanceof Error ? e.message : 'failed to start session';
		} finally {
			startAbort = undefined;
		}
	}

	async function cancel(): Promise<void> {
		// Round-8 audit R8-INFO-02 + R8-DESIGN-02: reject re-entry.
		// DashLogin has 3 cancel call-sites (onDestroy, $effect on
		// close, retry()); back-to-back invocations used to fire
		// duplicate POST /cancel + re-arm the trap-deadline.
		if (destroyed || cancelling) return;
		cancelling = true;
		// Round-9 audit R9-SEC-01: arm the R6-SEC-01 trap-deadline
		// BEFORE the await. Defense in depth — even if a future
		// regression removes the isClient AbortController, the
		// deadline still fires and force-fails the modal so a
		// hostile server can't pin the user indefinitely. Cleared
		// in the finally OR overwritten with the post-conflict
		// timer below.
		//
		// Round-10 audit R10-CORR-03 + R10-DRIFT-CANCEL-PRE-AWAIT-...
		// outerExpired flag signals 'deadline already fired' so a
		// late await that resolves AFTER the timer doesn't re-arm
		// the conflict banner or write phase. Belt-and-braces with
		// the `cancelling` flag which the deadline callback already
		// resets.
		let outerExpired = false;
		const cancelCallDeadline = setTimeout(() => {
			if (destroyed) return;
			outerExpired = true;
			cancelling = false;
			postCancelConflict = false;
			stopPolling();
			if (!status || !isTerminal(status.state)) {
				phase = 'failed';
				error = 'cancel did not complete in time';
			}
		}, POST_CANCEL_DEADLINE_MS);
		try {
			const sid = startResponse?.sid;
			const cancelToken = startResponse?.addressSignature;
			// Round-7 audit R7-CORR-02: reset the conflict banner on
			// every call so a later clean cancel clears the previous
			// 'finishing server-side step' state.
			postCancelConflict = false;
			// Round-5 audit R5-002 + round-6 R6-CORR-04 + round-7 R7-DRIFT-02:
			// the client's CancelResult discriminator now covers all three
			// outcomes (clean cancel, server 409 in-flight refusal, transient
			// network/5xx error). 'in-flight-conflict' and 'error' both
			// keep polling so the user reaches a real terminal state.
			if (sid && cancelToken) {
				const outcome: CancelResult = await client.cancel(sid, cancelToken);
				// Round-10 audit R10-CORR-03: bail if the outer
				// trap-deadline already fired while the await was
				// pending; otherwise we'd reset the banner and
				// re-arm a fresh deadline against a session that's
				// already been force-failed.
				if (destroyed || outerExpired) return;
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
							if (destroyed) return;
							postCancelConflict = false;
							stopPolling();
							// Round-10 audit R10-CORR-CANCEL-NO-STATUS-01:
							// the 'cancel acknowledged...' message is
							// valid even when /status never landed
							// (user paid before first poll, server
							// rejected, etc). Don't gate it on status.
							if (!status || !isTerminal(status.state)) {
								phase = 'failed';
								error = 'cancel acknowledged but session did not finish on the server in time';
							}
						}, POST_CANCEL_DEADLINE_MS);
					}
					return;
				}
			}
			stopPolling();
			// Round-10 audit R10-CORR-CANCEL-NO-STATUS-01: same as
			// above — the 'cancelled' message is valid regardless
			// of whether /status has reported anything yet.
			if (!status || !isTerminal(status.state)) {
				phase = 'failed';
				error = 'cancelled';
			}
		} finally {
			clearTimeout(cancelCallDeadline);
			cancelling = false;
		}
	}

	function stop(): void {
		// Round-8 audit R8-CORR-02: synchronous teardown for Svelte's
		// onDestroy. Mark destroyed first so any in-flight begin() /
		// poll() / cancel() resolves with a no-op tail. Then clear
		// timers.
		//
		// Round-9 audit R9-DESIGN-STOP-NOCANCEL-01: fire-and-forget
		// a server-side /cancel if we have a sid + token, so the
		// server's session and dashd-watcher entries get released
		// promptly rather than waiting for the 30-min TTL.
		//
		// Round-10 audit R10-CORR-ORPHAN-SESSION-01: if the user
		// unmounts BEFORE /session/start resolves, we have no sid
		// yet — but we DO have an AbortController on the in-flight
		// fetch. Abort it so the server either (a) sees the
		// connection drop before PutNew (no leak) or (b) finishes
		// after — same as today's worst case, but no
		// indefinite-orphan window.
		const sid = startResponse?.sid;
		const token = startResponse?.addressSignature;
		destroyed = true;
		stopPolling();
		if (startAbort !== undefined) {
			startAbort.abort();
		}
		if (sid && token) {
			// Round-10 audit R10-INFO-01: client.cancel never throws,
			// but keep a defensive catch with a debug-level log so a
			// future refactor making it throw surfaces in browser
			// devtools instead of as an unhandled rejection.
			void client.cancel(sid, token).catch((e) => {
				console.debug('Dash session stop() fire-and-forget cancel rejected:', e);
			});
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
		cancel,
		stop
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
