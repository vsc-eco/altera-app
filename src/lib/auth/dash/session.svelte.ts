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
					error = next.forwardError || readableFailure(next.state);
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
		stopPolling();
		const sid = startResponse?.sid;
		// Mark UI cancelled immediately so a slow network doesn't leave
		// the modal stuck on "waiting".
		if (status && !isTerminal(status.state)) {
			phase = 'failed';
			error = 'cancelled';
		}
		if (sid) {
			try {
				await client.cancel(sid);
			} catch {
				/* server may already have GC'd — fine */
			}
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

function readableFailure(state: IsSessionState): string {
	switch (state) {
		case 'ATTESTATION_TIMEOUT':
			return 'validator quorum not reached in time';
		case 'FORWARD_FAILED':
			return 'on-chain forward failed';
		case 'EXPIRED':
			return 'session expired before payment was observed';
		default:
			return `session failed in state ${state}`;
	}
}
