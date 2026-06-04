<script lang="ts">
	import { onDestroy } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import Qr from '$lib/zag/QR.svelte';
	import { ArrowRight, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion } from '@lucide/svelte';
	import { isServiceUrl, isServiceSignerPubkey, getDashNetwork } from './dash/config';
	import { createDashSession } from './dash/session.svelte';
	import { addressFingerprint, buildDashUri, type IsSessionState } from './dash/isClient';
	import { verifyAddressSignature, type SignatureVerdict } from './dash/signature';
	import { buildDashDID } from './dashCaip';
	import { _dashAuthStore, cleanUpLogout } from './store';

	// Component-local. We only support op=auth here; op=call is a future
	// surface (contract-call deep-link from inside the app's swap flow).
	const session = createDashSession({ baseUrl: isServiceUrl, op: 'auth' });

	// Round-7 audit R7-CORR-01-altera + round-8 audit R8-CORR-02:
	// use session.stop() (synchronous teardown) on unmount. The
	// previous onDestroy(() => cancel()) leaked the pollTimer +
	// R6-SEC-01 trap-deadline on the 409 / network-error branches
	// because cancel() intentionally returns early in those cases
	// without calling stopPolling. stop() marks the session
	// destroyed AND clears both timers unconditionally — no server
	// round-trip, no race with begin()'s post-await tail.
	//
	// Round-11 audit R11-INFO-RETRY-50MS-TIMER-LEAK-01: also clear
	// the retry()'s 50ms close-then-open setTimeout. The
	// destroyed-guard in session.begin() already protects against
	// the late callback firing on a torn-down session, but
	// clearing the timer prevents the setTimeout closure from
	// holding onto component state past unmount.
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => {
		if (retryTimer !== undefined) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
		session.stop();
	});

	let close = $state(() => {});

	// When the user opens the modal, kick off a session. When they close
	// it via X / Esc / overlay click, the Dialog's toggle handler fires
	// cancel. We track open state through Dialog's open binding.
	let open = $state(false);
	$effect(() => {
		// Round-9 audit R9-DESIGN-RETRY-01 / round-10 audit R10-CORR-02:
		// reverted to 'idle'-only gate. The broadened
		// 'idle'||'failed' gate let a fast-rejecting startSession
		// flip phase=failed→starting→failed→starting in a tight
		// loop, hammering the server. The retry() flow now calls
		// session.begin() explicitly after cancel + reopen so a
		// single retry click triggers exactly one begin() attempt.
		if (open && session.phase === 'idle') {
			void session.begin();
		}
		if (!open && session.phase === 'waiting') {
			// User closed mid-flow — best-effort cancel server-side.
			void session.cancel();
		}
	});

	// When the session reaches ON_CHAIN, hand the sessionToken to the
	// auth store as a DashDID identity. The auth store consumer (root
	// layout + protected routes) treats this as the logged-in subject.
	//
	// Audit D2-DESIGN-01: the DID format MUST be
	//   did:pkh:bip122:<chain-genesis-hex>:<address>
	// matching go-vsc-node lib/dids/dash.go + the dash-mapping-contract's
	// dashGenesisCAIP2Hex helper. The earlier literal-"dash" form
	// produced a different string for the same user, so every Altera
	// screen reading state by auth.value.did returned empty zero.
	// If senderAddress is absent (rare — contract would reject the
	// underlying tx anyway), we fail loudly instead of building a
	// malformed DID with a txid in the address slot.
	$effect(() => {
		if (session.phase === 'done' && session.status?.sessionToken && session.status?.dashTxId) {
			const senderAddr = session.status.senderAddress;
			if (!senderAddr) {
				console.error(
					'DashLogin: ON_CHAIN reached but senderAddress missing in /status — refusing to issue a malformed DID. Cancelling.'
				);
				void session.cancel();
				return;
			}
			const did = buildDashDID(getDashNetwork(), senderAddr);
			// Round-4 audit R4-CSM-03: write to _dashAuthStore, not
			// _hiveAuthStore. Sharing storage with Hive let
			// account_changed / hiveLogout / init events destroy the
			// logged-in Dash session and made Hive's profile-pic
			// subscriber dispatch dhive lookups against the DashDID.
			_dashAuthStore.set({
				status: 'authenticated',
				value: {
					username: 'dash:' + senderAddr.slice(0, 8),
					address: did,
					did,
					// Round-3 audit R3-003: distinct provider tag so downstream
					// (QuickSwap / currentBalance / Portfolio / transactions /
					// (authed)/+layout) can branch on Dash vs Hive rather than
					// silently treating Dash users as Hive users (and dispatching
					// dhive lookups against the synthetic 'dash:XYabc...' username).
					provider: 'dash-instantsend',
					logout: async () => {
						// Round-5 audit R5-003: mirror hiveLogout — wipe
						// balances, transaction store, and route back to
						// /login. Without cleanUpLogout(), stale Hive-
						// shaped account state lingers in
						// accountBalance/accountBalanceHistory/txStores
						// after a Dash logout.
						_dashAuthStore.set({ status: 'none' });
						cleanUpLogout();
					},
					openSettings: () => {},
					profilePicUrl: undefined
				}
			});
			close();
		}
	});

	// Verify the address signature against the pinned IS-service pubkey.
	// Runs once when the start response arrives; result drives the badge
	// shown next to the address. When `unconfigured` (no pubkey set) or
	// `unsupported` (browser lacks Ed25519 WebCrypto), the panel falls
	// back to a yellow warn-panel that tells the user crypto-verification
	// was unavailable — NOT to "match against an operator-published
	// fingerprint", since the fingerprint is per-session (audit R19-SEC-
	// fingerprint-warn-panel-no-canonical-source-exists).
	let sigVerdict = $state<SignatureVerdict | undefined>(undefined);
	$effect(() => {
		const r = session.startResponse;
		if (!r) {
			sigVerdict = undefined;
			return;
		}
		void verifyAddressSignature({
			depositAddress: r.depositAddress,
			instruction: hexToString(r.depositInstructionHex),
			signatureB64: r.addressSignature,
			pinnedPubkey: isServiceSignerPubkey
		}).then((v) => {
			sigVerdict = v;
			// Audit R16-OPS-altera-invalid-sig-no-session-cancel (HIGH):
			// when the verdict is 'invalid' the QR is hidden (see the
			// {:else if} branch on render), but pre-R16 the underlying
			// session kept polling /status forever — consuming RC, the
			// IS service's session-store slot, and dashd-watcher map
			// space. Cancel the session at the moment the verdict
			// arrives so the orchestrator releases all of those.
			if (v?.kind === 'invalid') {
				void session.cancel();
			}
		});
	});

	function hexToString(h: string): string {
		// depositInstructionHex is hex(instruction string) — opt-out of
		// shell-escaping. Decode back to the ASCII bytes the IS-service
		// signed.
		if (!h) return '';
		let out = '';
		for (let i = 0; i < h.length; i += 2) {
			out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
		}
		return out;
	}

	const stateLabel = $derived(humanState(session.status?.state));
	const requiredDash = $derived(
		session.startResponse
			? (session.startResponse.requiredAmountDuffs / 1e8).toFixed(8)
			: undefined
	);
	const fingerprint = $derived(
		session.startResponse ? addressFingerprint(session.startResponse.addressSignature) : undefined
	);
	const dashUri = $derived(
		session.startResponse
			? buildDashUri(session.startResponse.depositAddress, session.startResponse.requiredAmountDuffs)
			: undefined
	);

	function humanState(s: IsSessionState | undefined): string {
		if (!s) return 'Preparing…';
		switch (s) {
			case 'WAITING_FOR_IS':
				return 'Waiting for InstantSend payment';
			case 'IS_OBSERVED':
				return 'Payment seen, gathering validator signatures…';
			case 'ATTESTING':
				return 'Gathering validator signatures…';
			case 'L2_SUBMITTED':
				// Round-4 audit R4-CSM-04: the IS service emits this
				// during reconcileL2 (seconds to minutes); without a
				// matching switch case the Status line rendered blank
				// for the entire reconcile window.
				return 'Submitted on-chain, awaiting confirmation…';
			case 'ON_CHAIN':
				return 'Logged in';
			case 'ATTESTATION_TIMEOUT':
				return 'Validators did not respond in time';
			case 'SLOW_PATH_PENDING':
				return 'Falling back to slow path (mined-block proof)';
			case 'FORWARD_FAILED':
				return 'On-chain step failed';
			case 'EXPIRED':
				return 'Session expired';
		}
	}

	async function retry() {
		// Round-10 audit R10-CORR-02: retry() drives begin() once,
		// explicitly. The pre-R10 'broaden the effect gate' approach
		// (R9-DESIGN-RETRY-01) flipped failed→starting→failed in a
		// tight loop against a fast-rejecting server. The 50ms
		// close/open is preserved for UX (visible reset feedback);
		// the begin() call is what actually restarts the session.
		//
		// Round-11 audit R11-INFO-RETRY-50MS-TIMER-LEAK-01: track
		// the timer handle so onDestroy can clear it if the user
		// unmounts within 50ms of clicking Try again.
		await session.cancel();
		open = false;
		if (retryTimer !== undefined) clearTimeout(retryTimer);
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			open = true;
			void session.begin();
		}, 50);
	}
</script>

<Dialog bind:toggle={close} bind:open>
	Sign in with DashPay
	{#snippet title()}
		Sign in with DashPay
	{/snippet}

	{#snippet content()}
		{#if session.phase === 'starting' || (session.phase === 'waiting' && !session.startResponse)}
			<p class="muted">Preparing your session…</p>
		{:else if session.phase === 'waiting' && session.startResponse && sigVerdict === undefined}
			<!-- Audit R16-CORR-altera-qr-renders-before-sigverdict-resolved
				 (MED) + R16-SEC-altera-sig-toctou-pre-verdict-render (LOW):
				 verifyAddressSignature is async; between session.startResponse
				 arriving and the promise resolving, sigVerdict is undefined.
				 Pre-fix the {:else if} for `invalid` evaluated false on
				 undefined and control fell into the QR-rendering branch
				 below — so a user on a slow CPU / older browser could scan
				 + pay BEFORE the verdict arrived, defeating the SEC-2 gate.
				 Show a verify-pending spinner-equivalent placeholder until
				 the verdict resolves. -->
			<p class="muted">Verifying IS-service response…</p>
		{:else if session.phase === 'waiting' && session.startResponse && sigVerdict?.kind === 'invalid'}
			<!-- Audit SEC-2 (R15) + R16-OPS-altera-invalid-sig-no-session-cancel:
				 hard fail-closed when the IS-service address signature does
				 NOT verify against the pinned PUBLIC_IS_SERVICE_SIGNER_PUBKEY.
				 Pre-fix the QR + address still rendered with only an inline
				 red-shield badge — a user who'd successfully scanned + paid
				 in prior sessions was nudged toward doing it again. The
				 underlying session.cancel() is fired at verdict-resolution
				 time (see the $effect above) so the orchestrator releases
				 RC + session-store + watcher state. -->
			<div class="sig-fail-panel">
				<p class="sig-fail-title">
					<ShieldAlert size={16} /> IS-service signature did not verify
				</p>
				<p>
					The address Altera received from the IS service could
					not be cryptographically tied to the pinned signer
					public key. <strong>Do not scan or pay anything.</strong>
					This can mean a network-level interception, a hostile
					proxy, or an operator-side key rotation that has not
					been propagated to this build.
				</p>
				<p class="muted">
					If you maintain this Altera deployment, verify
					<code>PUBLIC_IS_SERVICE_SIGNER_PUBKEY</code> matches
					the IS-service operator's current signer fingerprint,
					then reload.
				</p>
			</div>
		{:else if session.phase === 'waiting' && session.startResponse}
			<p class="muted">Pay the address below from your DashPay wallet via InstantSend.</p>
			{#if sigVerdict?.kind === 'unsupported' || sigVerdict?.kind === 'unconfigured'}
				<!-- Audit R16-SEC-altera-sigverdict-unsupported-renders-qr
					 (MED) + R19-SEC-fingerprint-warn-panel-no-canonical-
					 source-exists + R21 cluster (R20 claimed to rewrite
					 this comment but the diff missed it): when the browser
					 can't run Ed25519 WebCrypto (older Chrome/Firefox/
					 Safari) OR the operator hasn't pinned PUBLIC_IS_
					 SERVICE_SIGNER_PUBKEY, the QR still renders. We don't
					 fail-closed in this branch (it would brick legitimate
					 older-browser users), but we surface the missing-
					 verification state as a prominent yellow warn-panel so
					 the user can't miss it. The panel does NOT instruct
					 comparing the on-screen fingerprint against any
					 operator-published value — per R19 the fingerprint is
					 per-session-internal (regenerated every session) and
					 no canonical source exists to compare against. The
					 user's defense is to judge the website name + the
					 operator they trust, NOT a hash comparison. -->
				<div class="sig-warn-panel">
					<p class="sig-warn-title">
						<ShieldQuestion size={16} />
						{sigVerdict?.kind === 'unsupported'
							? 'Verification unavailable in this browser'
							: 'Verification not configured'}
					</p>
					<p>
						Altera cannot verify the deposit address shown below.
						{sigVerdict?.kind === 'unsupported'
							? "Your browser doesn't support the cryptographic check Altera normally uses."
							: "This Altera build doesn't have its IS-service signer pubkey pinned."}
					</p>
					<p>
						<strong>Only proceed if you trust this website and
						its operator.</strong> Check the website name (in
						the URL bar on desktop, or your in-app browser
						title) — if anything looks unfamiliar, do not pay.
						Close this dialog and report it.
					</p>
				</div>
			{/if}
			{#if dashUri}
				<Qr data={dashUri} />
			{/if}
			<dl class="meta">
				<dt>Address</dt>
				<dd class="mono">
					{session.startResponse.depositAddress}
					{#if sigVerdict?.kind === 'valid'}
						<span class="sig sig-ok" title="address signature verified"
							><ShieldCheck size={12} /> verified</span
						>
					{:else if sigVerdict?.kind === 'unconfigured' || sigVerdict?.kind === 'unsupported'}
						<!-- Audit R20-CORR-altera-check-fingerprint-badge-
							 implies-security-check + R20-OPS-dashlogin-badge-
							 tooltip-and-text-still-say-fall-back-to-
							 fingerprint: the badge used to read "fall back to
							 fingerprint check", implying the fingerprint
							 provides a meaningful security gate. Per R19 the
							 fingerprint is session-internal only — no static
							 operator-published value to compare against. Badge
							 now reads "not verified" with a tooltip that
							 names the actual situation. -->
						<span class="sig sig-unknown" title="cryptographic verification unavailable — see warning above"
							><ShieldQuestion size={12} /> not verified</span
						>
					{/if}
				</dd>
				<dt>Fingerprint</dt>
				<dd class="mono">{fingerprint}</dd>
				<dt>Amount</dt>
				<dd>{requiredDash} DASH</dd>
				<dt>Status</dt>
				<dd>{stateLabel}</dd>
				{#if session.status?.senderAddress}
					<dt>From</dt>
					<dd class="mono">{session.status.senderAddress}</dd>
				{/if}
			</dl>
			{#if session.postCancelConflict}
				<!-- Round-10 audit R10-DRIFT-DASHSESSION-UNUSED-PROPS:
					 surface the R6-SEC-01 post-cancel-conflict banner.
					 Round-11 audit R11-OPS-BANNER-COPY-01 dropped the
					 'validator attestation' / 'on-chain step' jargon
					 in favour of plain language at frustration-peak. -->
				<p class="muted">
					Almost done — your sign-in is finishing the current step
					before it can be cancelled. This usually takes a few seconds.
				</p>
			{/if}
			<p class="footnote">
				The fingerprint is a short visual identifier for this
				session's deposit address — useful for spotting an obvious
				mid-flight swap when comparing the dialog and your wallet
				side-by-side. The cryptographic check that actually
				authenticates the response is the signed-address
				verification (signaled by the verified/mismatch badge above).
			</p>
		{:else if session.phase === 'done'}
			<p>Signed in. Redirecting…</p>
		{:else if session.phase === 'failed'}
			<p class="error">{session.error ?? 'Login failed.'}</p>
			<PillButton onclick={retry} theme="primary" styleType="outline">
				<RefreshCw size={14} /> Try again
			</PillButton>
		{/if}
	{/snippet}
</Dialog>

<div class="trigger" onclick={() => (open = true)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') open = true; }}>
	<div class="trigger-left">
		<img src="/dash/dash-logo.svg" alt="" class="trigger-icon" />
		<div class="trigger-text">
			<span class="trigger-label">DashPay</span>
			<span class="trigger-hint">InstantSend login · no signing needed</span>
		</div>
	</div>
	<ArrowRight size={16} class="trigger-arrow" />
</div>

<style lang="scss">
	.trigger {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		background: #1a1f35;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		box-sizing: border-box;
		&:hover {
			border-color: rgba(0, 142, 219, 0.5);
			box-shadow: 0 0 20px rgba(0, 142, 219, 0.1);
		}
		&:focus-visible {
			outline: 2px solid rgba(0, 142, 219, 0.5);
			outline-offset: 2px;
		}
	}
	.trigger-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.trigger-icon {
		width: 20px;
		height: 20px;
		filter: brightness(1.1);
	}
	.trigger-text {
		display: flex;
		flex-direction: column;
	}
	.trigger-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--dash-text-primary, white);
	}
	.trigger-hint {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.3);
		margin-top: 0.1rem;
	}

	.muted {
		color: var(--dash-text-secondary, rgba(255, 255, 255, 0.5));
		text-align: center;
	}
	.meta {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 0.75rem;
		font-size: 0.85rem;
		margin: 0.75rem 0 0.5rem;
	}
	.meta dt {
		color: var(--dash-text-muted, rgba(255, 255, 255, 0.4));
	}
	.meta dd {
		margin: 0;
		color: var(--dash-text-primary, white);
		overflow-wrap: anywhere;
	}
	.mono {
		font-family: 'Noto Sans Mono Variable', ui-monospace, monospace;
	}
	.footnote {
		font-size: 0.7rem;
		color: var(--dash-text-muted, rgba(255, 255, 255, 0.35));
		margin: 0.5rem 0 0;
	}
	.error {
		color: #fda4af;
		text-align: center;
		margin: 0.5rem 0 1rem;
	}
	.sig {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		margin-left: 0.4rem;
		padding: 0.05rem 0.4rem;
		border-radius: 1rem;
		font-size: 0.7rem;
		vertical-align: middle;
	}
	.sig-ok {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
	}
	.sig-unknown {
		background: rgba(251, 191, 36, 0.1);
		color: #facc15;
	}
	.sig-fail-panel {
		display: flex;
		flex-direction: column;
		gap: 0.6em;
		padding: 1em;
		border: 1px solid rgba(248, 113, 113, 0.5);
		background: rgba(248, 113, 113, 0.1);
		border-radius: 4px;
		color: #f87171;
		strong {
			color: #fca5a5;
		}
		code {
			background: rgba(0, 0, 0, 0.25);
			padding: 0 0.3em;
			border-radius: 2px;
			font-size: 0.9em;
		}
	}
	.sig-fail-title {
		display: flex;
		align-items: center;
		gap: 0.4em;
		font-weight: 600;
		margin: 0;
	}
	.sig-warn-panel {
		display: flex;
		flex-direction: column;
		gap: 0.6em;
		padding: 0.8em 1em;
		border: 1px solid rgba(251, 191, 36, 0.5);
		background: rgba(251, 191, 36, 0.1);
		border-radius: 4px;
		color: #facc15;
		margin-bottom: 0.8em;
		strong {
			color: #fde68a;
		}
	}
	.sig-warn-title {
		display: flex;
		align-items: center;
		gap: 0.4em;
		font-weight: 600;
		margin: 0;
	}
</style>
