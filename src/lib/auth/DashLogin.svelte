<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import Qr from '$lib/zag/QR.svelte';
	import { ArrowRight, RefreshCw } from '@lucide/svelte';
	import { isServiceUrl } from './dash/config';
	import { createDashSession } from './dash/session.svelte';
	import { addressFingerprint, buildDashUri, type IsSessionState } from './dash/isClient';
	import { _hiveAuthStore } from './store';

	// Component-local. We only support op=auth here; op=call is a future
	// surface (contract-call deep-link from inside the app's swap flow).
	const session = createDashSession({ baseUrl: isServiceUrl, op: 'auth' });

	let close = $state(() => {});

	// When the user opens the modal, kick off a session. When they close
	// it via X / Esc / overlay click, the Dialog's toggle handler fires
	// cancel. We track open state through Dialog's open binding.
	let open = $state(false);
	$effect(() => {
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
	$effect(() => {
		if (session.phase === 'done' && session.status?.sessionToken && session.status?.dashTxId) {
			const token = session.status.sessionToken;
			const txid = session.status.dashTxId;
			// We don't (yet) know the user's Dash L1 address from the
			// status response — the IS service has it (it's in the rawTx),
			// but doesn't surface it back. For v1 we use the txid as the
			// identity anchor; the dashboard fills in the L1 address from
			// the dash-mapping-contract state via DashDID -> address.
			_hiveAuthStore.set({
				status: 'authenticated',
				value: {
					username: 'dash:' + txid.slice(0, 8),
					address: 'did:vsc:dash:' + txid,
					did: 'did:vsc:dash:' + txid,
					provider: 'aioha',
					logout: async () => {
						_hiveAuthStore.set({ status: 'none' });
					},
					openSettings: () => {},
					profilePicUrl: undefined
				}
			});
			close();
		}
	});

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
		await session.cancel();
		// createDashSession is closed-over; re-create on retry to reset
		// state cleanly. Svelte will re-run the open effect.
		open = false;
		setTimeout(() => {
			open = true;
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
		{:else if session.phase === 'waiting' && session.startResponse}
			<p class="muted">Pay the address below from your DashPay wallet via InstantSend.</p>
			{#if dashUri}
				<Qr data={dashUri} />
			{/if}
			<dl class="meta">
				<dt>Address</dt>
				<dd class="mono">{session.startResponse.depositAddress}</dd>
				<dt>Fingerprint</dt>
				<dd class="mono">{fingerprint}</dd>
				<dt>Amount</dt>
				<dd>{requiredDash} DASH</dd>
				<dt>Status</dt>
				<dd>{stateLabel}</dd>
			</dl>
			<p class="footnote">
				The fingerprint should match the value Altera shows in its docs. If it doesn't, do
				not pay — close this dialog and report the discrepancy.
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
</style>
