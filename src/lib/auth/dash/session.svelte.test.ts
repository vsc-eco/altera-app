/**
 * Round-10/11/12/13/14 audit follow-up — TEST-COV-NO-UNIT-TESTS-FOR-
 * DASH-AUTH: 13+ rounds of subtle race-guard fixes accumulated in
 * createDashSession (gen counters, three AbortControllers, two
 * deadline timers, three concurrency-guard flags) had been verified
 * by static reading only. This harness pins the invariants those
 * fixes promise. R14-DRIFT-TEST-HEADER-NUMBERED-LIST-STALE replaced
 * the hand-maintained numbered list — the canonical list is the
 * describe() / it() blocks below, which vitest discovers anyway;
 * a numbered prose list drifted out of sync at every round-add.
 *
 * Property areas covered (see describe() blocks for one-to-one
 * mapping to specific finding IDs):
 *   - lifecycle re-entry guards (begin/stop/cancel idempotence)
 *   - in-flight AbortController plumbing (start, poll, cancel)
 *   - gen-counter race guards across stopPolling/cancel/teardown
 *   - 409 in-flight-conflict semantics + post-cancel trap deadline
 *   - backoff staircase reset + cap edge-trigger (R12/R13/R14)
 *   - orphan-microrace fire-and-forget cancel (R11)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock IsServiceClient before importing session.svelte.ts. The factory
// uses `new IsServiceClient(opts.baseUrl)` directly; vi.mock is hoisted
// so this swap lands before createDashSession imports the symbol.
//
// We hold the per-test mock object via globalThis so the factory hands
// each new session the same instance and tests can drive it.
type MockClient = {
	startSession: ReturnType<typeof vi.fn>;
	getStatus: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
};

declare global {
	// eslint-disable-next-line no-var
	var __dashTestClient: MockClient;
}

vi.mock('./isClient', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./isClient')>();
	// Constructible shim — session.svelte.ts does `new IsServiceClient(baseUrl)`.
	// Each construction returns the test's current per-test mock.
	class TestIsServiceClient {
		startSession: MockClient['startSession'];
		getStatus: MockClient['getStatus'];
		cancel: MockClient['cancel'];
		constructor(_baseUrl: string) {
			const m = globalThis.__dashTestClient;
			this.startSession = m.startSession;
			this.getStatus = m.getStatus;
			this.cancel = m.cancel;
		}
	}
	return {
		...actual,
		IsServiceClient: TestIsServiceClient
	};
});

import { createDashSession, type DashSession } from './session.svelte';
import { IsServiceError, type SessionStartResponse } from './isClient';

const PARITY_DEPOSIT_ADDRESS = 'tdash1qexamplemockaddressxxxxxxxxxxxxxxxx';

function makeStartResponse(over: Partial<SessionStartResponse> = {}): SessionStartResponse {
	return {
		sid: 'sid-test',
		depositAddress: PARITY_DEPOSIT_ADDRESS,
		depositInstructionHex: '6f703d617574683b7369643d7369642d74657374',
		addressSignature: 'addr-sig-test-base64',
		requiredAmountDuffs: 10_000_000,
		expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
		statusUrl: '/session/sid-test/status',
		...over
	};
}

/**
 * A controllable Promise — resolves/rejects on demand so tests can
 * drive the stop()-during-startSession race deterministically.
 */
function deferred<T>(): {
	promise: Promise<T>;
	resolve: (v: T) => void;
	reject: (e: unknown) => void;
} {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

let session: DashSession;

beforeEach(() => {
	globalThis.__dashTestClient = {
		startSession: vi.fn(),
		getStatus: vi.fn(),
		cancel: vi.fn()
	};
});

afterEach(() => {
	// Best-effort: tear down whatever session the test created so
	// timers/aborts don't leak between cases.
	if (session) session.stop();
	vi.useRealTimers();
});

// ───────────────────────────── (1) shape-check ─────────────────────────────

describe('startSession malformed-response shape-check (R12-INFO-...)', () => {
	it('phase flips to failed when startSession throws IsServiceError(200, malformed)', async () => {
		globalThis.__dashTestClient.startSession.mockRejectedValueOnce(
			new IsServiceError(200, 'malformed /session/start response')
		);
		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		expect(session.phase).toBe('failed');
		expect(session.error).toContain('malformed');
	});

	// Round-13 audit R13-INFO-SHAPECHECK-ASYMMETRIC-FIELDS captured the
	// known gap: a server returning {sid:'', addressSignature:''}
	// passes the typeof===string gate. We pin the CURRENT behaviour so
	// a future tightening flip (empty-string reject) shows up
	// explicitly in the diff rather than as a silent change.
	it('CURRENT behaviour: empty sid+addressSignature pass the shape-check', async () => {
		globalThis.__dashTestClient.startSession.mockResolvedValueOnce(
			makeStartResponse({ sid: '', addressSignature: '' })
		);
		globalThis.__dashTestClient.getStatus.mockResolvedValue({
			sid: '',
			state: 'WAITING_FOR_IS',
			expiresAt: new Date(Date.now() + 30 * 60_000).toISOString()
		});
		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		expect(session.phase).toBe('waiting');
		// R13-INFO-...: the orphan-microrace fire-and-forget cancel
		// in stop() would skip on empty strings because of the
		// `if (sr.sid && sr.addressSignature)` guard. Documented gap.
	});
});

// ─────── (2) orphan-microrace cancel + (4) stop aborts startSession ────────

describe('R11-CORR-ORPHAN-FETCH-MICRORACE + R10-CORR-ORPHAN-SESSION-01', () => {
	it('stop() during in-flight startSession aborts the AbortController', async () => {
		const d = deferred<SessionStartResponse>();
		let capturedSignal: AbortSignal | undefined;
		globalThis.__dashTestClient.startSession.mockImplementationOnce(
			(_body: unknown, signal?: AbortSignal) => {
				capturedSignal = signal;
				return d.promise;
			}
		);

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		const beginPromise = session.begin();
		// Yield once so begin() has had a chance to call client.startSession.
		await Promise.resolve();
		expect(capturedSignal).toBeDefined();
		expect(capturedSignal!.aborted).toBe(false);

		session.stop();
		expect(capturedSignal!.aborted).toBe(true);

		// Cleanly resolve the deferred so begin()'s try doesn't dangle.
		d.reject(new DOMException('aborted', 'AbortError'));
		await beginPromise;
		expect(session.phase).not.toBe('waiting');
	});

	it('orphan microrace: stop() between fetch resolve and startResponse assignment → fire-and-forget cancel', async () => {
		const d = deferred<SessionStartResponse>();
		globalThis.__dashTestClient.startSession.mockReturnValueOnce(d.promise);
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		const beginPromise = session.begin();
		await Promise.resolve(); // let begin reach the await

		// Sequence: call stop() FIRST (sets destroyed=true), THEN
		// resolve the startSession promise. begin()'s post-await branch
		// observes destroyed=true and fires fire-and-forget /cancel.
		session.stop();
		d.resolve(makeStartResponse({ sid: 'orphan-sid', addressSignature: 'orphan-token' }));
		await beginPromise;

		expect(globalThis.__dashTestClient.cancel).toHaveBeenCalledTimes(1);
		expect(globalThis.__dashTestClient.cancel).toHaveBeenCalledWith('orphan-sid', 'orphan-token');
		// And destroyed-guard prevents state writes.
		expect(session.startResponse).toBeUndefined();
		expect(session.phase).not.toBe('waiting');
	});
});

// ────────── (3) stop() re-entry idempotency (R11-DESIGN-STOP-...) ──────────

describe('R11-DESIGN-STOP-NO-REENTRY-GUARD', () => {
	it('two back-to-back stop() calls invoke client.cancel at most once', async () => {
		globalThis.__dashTestClient.startSession.mockResolvedValue(
			makeStartResponse({ sid: 'sid-reentry', addressSignature: 'token-reentry' })
		);
		globalThis.__dashTestClient.getStatus.mockResolvedValue({
			sid: 'sid-reentry',
			state: 'WAITING_FOR_IS',
			expiresAt: new Date(Date.now() + 30 * 60_000).toISOString()
		});
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Drop the immediate poll() microtask but don't advance the 2s
		// poll interval timer.
		await Promise.resolve();

		session.stop();
		session.stop();
		expect(globalThis.__dashTestClient.cancel).toHaveBeenCalledTimes(1);
	});
});

// ────────── (5) cancel() does NOT abort pollAbort (R12-DESIGN-...) ─────────

describe('R12-DESIGN-CANCEL-DOES-NOT-ABORT-POLLABORT', () => {
	it('cancel() success branch leaves an in-flight /status fetch running', async () => {
		// Use real timers — the poll tick at delay=0 still has to run,
		// but vi.useFakeTimers would freeze the microtask that resolves
		// startSession before schedulePoll arms its setTimeout(tick,0).
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());

		// Make getStatus return a never-resolving promise but capture
		// its signal so the test can check `aborted` after cancel().
		const statusDeferred = deferred<unknown>();
		let capturedSignal: AbortSignal | undefined;
		globalThis.__dashTestClient.getStatus.mockImplementation(
			(_sid: string, signal?: AbortSignal) => {
				capturedSignal = signal;
				return statusDeferred.promise as Promise<never>;
			}
		);
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Let the immediate first poll setTimeout(tick, 0) fire and
		// reach the getStatus await.
		await new Promise((r) => setTimeout(r, 0));
		expect(capturedSignal).toBeDefined();
		expect(capturedSignal!.aborted).toBe(false);

		await session.cancel();
		// The pollAbort signal must NOT have been aborted by cancel()
		// — R12 documented intent is to let the in-flight /status
		// resolve on its own and rely on the gen-guard to make any
		// late write benign.
		expect(capturedSignal!.aborted).toBe(false);
	});
});

// ────────── (6) cancel 409 → postCancelConflict + keep polling ───────────

describe('R5-002 / R10-CORR-02 cancel 409 in-flight-conflict branch', () => {
	it('phase stays "waiting" and postCancelConflict=true on 409', async () => {
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());
		globalThis.__dashTestClient.getStatus.mockResolvedValue({
			sid: 'sid-test',
			state: 'ATTESTING',
			expiresAt: new Date(Date.now() + 30 * 60_000).toISOString()
		});
		globalThis.__dashTestClient.cancel.mockResolvedValue('in-flight-conflict');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Let the first poll land.
		await new Promise((r) => setTimeout(r, 0));
		await session.cancel();

		expect(session.phase).toBe('waiting');
		expect(session.postCancelConflict).toBe(true);
	});
});

// ──────── stop() aborts in-flight /status (R11-INFO-GETSTATUS-...) ────────

describe('R11-INFO-GETSTATUS-NO-EXTERNAL-SIGNAL', () => {
	it('stop() aborts the in-flight getStatus AbortController', async () => {
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());
		const statusD = deferred<unknown>();
		let capturedSignal: AbortSignal | undefined;
		globalThis.__dashTestClient.getStatus.mockImplementation(
			(_sid: string, signal?: AbortSignal) => {
				capturedSignal = signal;
				return statusD.promise as Promise<never>;
			}
		);
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		await new Promise((r) => setTimeout(r, 0));
		expect(capturedSignal).toBeDefined();
		expect(capturedSignal!.aborted).toBe(false);

		session.stop();
		expect(capturedSignal!.aborted).toBe(true);
		// Let the deferred resolve so the awaiting promise chain clears.
		statusD.reject(new DOMException('aborted', 'AbortError'));
	});
});

// ──────── pollErrCount backoff resets on schedulePoll (R12-...) ──────────

describe('R12-CORR-POLLERRCOUNT-NOT-RESET-ACROSS-RETRY', () => {
	it('schedulePoll entry resets pollErrCount so the staircase restarts from 2s on retry', async () => {
		// Two begin() cycles on the same session instance. Attempt 1
		// errors three times → pollErrCount=3 by end. Attempt 2 must
		// start fresh (delay=2s on first failure, NOT 16s).
		//
		// We observe the cadence through the schedulePoll setTimeout
		// argument by spying on globalThis.setTimeout. Inside
		// schedulePoll the very first tick is `setTimeout(tick, 0)`;
		// subsequent ticks call `setTimeout(tick, nextDelay)`. We
		// count the second-and-later delays per attempt to verify
		// the staircase.
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());
		globalThis.__dashTestClient.getStatus.mockRejectedValue(new Error('network'));
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		const delays: number[] = [];
		const realSetTimeout = globalThis.setTimeout;
		const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(
			((fn: () => void, ms?: number) => {
				if (typeof ms === 'number' && ms > 0) delays.push(ms);
				return realSetTimeout(fn, 0); // collapse delays to immediate
			}) as typeof globalThis.setTimeout
		);

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Let multiple immediate ticks fire so the backoff staircase
		// has at least 3 entries on this attempt.
		for (let i = 0; i < 6; i++) await new Promise((r) => realSetTimeout(r, 0));
		const attempt1Delays = [...delays];
		expect(attempt1Delays.length).toBeGreaterThan(0);

		// Cancel + retry — should reset.
		await session.cancel();
		delays.length = 0;
		await session.begin();
		for (let i = 0; i < 4; i++) await new Promise((r) => realSetTimeout(r, 0));

		// Attempt 2's first non-zero delay must be the FRESH staircase
		// step (POLL_INTERVAL_MS * 2^1 = 4000 — pollErrCount is
		// incremented BEFORE the delay is computed in tick's catch),
		// NOT a continuation of attempt 1's last value (which would
		// be the 30000 cap since attempt 1 ran ≥6 failing ticks).
		const attempt2First = delays.find((d) => d > 0);
		expect(attempt2First).toBe(4000);

		// Sanity: attempt 1's tail had to reach the cap so the
		// not-reset failure mode would be observably different.
		expect(attempt1Delays).toContain(30_000);

		spy.mockRestore();
	});
});

// ────── pollErrCount reset on 409 cancel branch (R13-CORR-BACKOFF-...) ──────

describe('R13-CORR-BACKOFF-PERSISTS-ACROSS-IN-FLIGHT-CONFLICT-RETRY', () => {
	it('cancel() 409 in-flight-conflict resets pollErrCount so a retry restarts the staircase', async () => {
		// Attempt 1 fails several times → pollErrCount reaches the
		// 30s cap. User cancels; server replies 409. The R13 fix
		// must reset pollErrCount inside the 409 branch (R12 only
		// covered the clean-cancel branch via stopPolling).
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());
		globalThis.__dashTestClient.getStatus.mockRejectedValue(new Error('network'));
		globalThis.__dashTestClient.cancel.mockResolvedValue('in-flight-conflict');

		// Round-14 R14-VITEST-RELIES-ON-NODE-MACROTASK-FIFO: phase-
		// tag each setTimeout so the assertion proves the 4000 fires
		// AFTER cancel(), not just that the value appears in the
		// macrotask buffer. The audit found the prior `find(d => d>0
		// && d<=30_000)` was satisfied by a pre-cancel stale tick
		// happening to land in macrotask FIFO order — a refactor that
		// reorders insertions could pass-for-wrong-reason.
		type Phase = 'before' | 'after';
		const events: { ms: number; phase: Phase }[] = [];
		let phase: Phase = 'before';
		const realSetTimeout = globalThis.setTimeout;
		const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(
			((fn: () => void, ms?: number) => {
				if (typeof ms === 'number' && ms > 0) events.push({ ms, phase });
				return realSetTimeout(fn, 0);
			}) as typeof globalThis.setTimeout
		);

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Let the staircase climb to the 30s cap.
		for (let i = 0; i < 6; i++) await new Promise((r) => realSetTimeout(r, 0));
		expect(events.some((e) => e.ms === 30_000)).toBe(true);

		// Flip phase BEFORE cancel() starts so every setTimeout
		// scheduled from inside cancel() + post-cancel polling
		// gets tagged as 'after'. Pre-cancel stale ticks remain
		// 'before' even if they land in macrotask FIFO order
		// after we await cancel() — phase is closure-state, not
		// macrotask-order.
		phase = 'after';
		await session.cancel();
		for (let i = 0; i < 4; i++) await new Promise((r) => realSetTimeout(r, 0));

		// The cancel()-branch reset (R13-CORR fix) must produce a
		// 4000ms setTimeout call AFTER the phase flip. If reset is
		// broken the post-cancel staircase resumes from the 30s cap
		// instead, and no 4000 entry appears in the 'after' bucket.
		const POLL_BACKOFF_MAX_MS = 30_000;
		const afterEvents = events.filter(
			(e) => e.phase === 'after' && e.ms > 0 && e.ms <= POLL_BACKOFF_MAX_MS
		);
		const firstPollDelay = afterEvents.find((e) => e.ms === 4000);
		expect(
			firstPollDelay,
			`expected a 4000ms setTimeout AFTER cancel(); got phase-tagged events: ${JSON.stringify(events)}`
		).toBeDefined();

		spy.mockRestore();
	});
});

// ──────── (7) gen-guard: late getStatus does NOT overwrite cancel ─────────

describe('R11-CORR-POLL-WRITES-AFTER-STOPPOLLING', () => {
	it('getStatus that resolves after stopPolling/cancel does not flip phase to done', async () => {
		globalThis.__dashTestClient.startSession.mockResolvedValue(makeStartResponse());
		const statusD = deferred<{
			sid: string;
			state: string;
			sessionToken?: string;
			expiresAt: string;
		}>();
		globalThis.__dashTestClient.getStatus.mockReturnValue(statusD.promise);
		globalThis.__dashTestClient.cancel.mockResolvedValue('cancelled');

		session = createDashSession({ baseUrl: 'https://is.test', op: 'auth' });
		await session.begin();
		// Let schedulePoll arm + the first tick reach the getStatus await.
		await new Promise((r) => setTimeout(r, 0));

		// User cancels while getStatus is pending. stopPolling bumps
		// pollGen; phase becomes 'failed' / 'cancelled'.
		await session.cancel();
		expect(session.phase).toBe('failed');

		// NOW resolve the late getStatus with a terminal ON_CHAIN.
		// The gen-guard in poll() must drop this write — phase must
		// stay 'failed', NOT silently flip to 'done'.
		statusD.resolve({
			sid: 'sid-test',
			state: 'ON_CHAIN',
			sessionToken: 'late-token',
			expiresAt: new Date(Date.now() + 30 * 60_000).toISOString()
		});
		// Flush the microtask queue.
		await new Promise((r) => setTimeout(r, 0));
		expect(session.phase).toBe('failed');
	});
});
