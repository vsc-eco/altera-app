<!--
	The connect-wallet dialog.

	Extracted verbatim from `LandingPage` — same markup, same styles, same
	options (EVM / BTC via AppKit, then Hive) — so the dialog people already
	know is the one that opens everywhere. Rendered ONCE in the root layout
	and driven by the `connectOpen` store, because the places that need it now
	(the shell's Connect pill, the swap CTA) are not inside the landing page.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import AppKitLogin from '$lib/auth/AppKitLogin.svelte';
	import HiveLogin from '$lib/auth/HiveLogin.svelte';
	import { getAuth } from '$lib/auth/store';
	import { ArrowRight, Bitcoin, Wallet, X } from '@lucide/svelte';
	import { closeConnect, connectOpen } from './connectModal';

	/**
	 * Where the user was headed before the auth guard sent them away. Shown so
	 * they know the dialog is a detour, not the destination.
	 *
	 * Read when the dialog OPENS, not once at startup: this component is
	 * mounted for the lifetime of the app (it lives in the root layout), so a
	 * value captured at load would be whatever was stored then — stale by the
	 * time a guard stores a new one and opens the dialog.
	 *
	 * APP-10: never honour a stored redirect that points off-origin. It comes
	 * from localStorage, so it is attacker-controllable and would otherwise be
	 * an open redirect.
	 */
	let redirectTo = $state<URL | undefined>();

	function readRedirect(): URL | undefined {
		if (!browser) return undefined;
		try {
			const stored = localStorage.getItem('redirect_url');
			if (!stored) return undefined;
			const url = new URL(stored, window.location.origin);
			return url.origin === window.location.origin ? url : undefined;
		} catch {
			return undefined;
		}
	}

	$effect(() => {
		if ($connectOpen) redirectTo = readRedirect();
	});

	/**
	 * Close once the sign-in actually lands.
	 *
	 * `HiveLogin` has a `close` of its own, but it is bound to HiveLogin's OWN
	 * inner dialog (`bind:toggle={close}`) — it dismisses the Hive form and
	 * leaves this dialog sitting there, which is what the user saw after a
	 * successful Hive login.
	 *
	 * Keying on the auth state rather than on any one provider's callback
	 * means every route in here is covered — Hive, EVM, BTC — and the dialog
	 * closes when the login SUCCEEDS rather than when a button was pressed.
	 *
	 * Guarded on the dialog being open so an already-connected visitor who
	 * never opened it is not navigated anywhere.
	 */
	const auth = $derived(getAuth()());

	$effect(() => {
		if (!$connectOpen) return;
		if (auth?.status !== 'authenticated') return;
		const target = redirectTo;
		closeConnect();
		if (!browser) return;
		try {
			localStorage.removeItem('redirect_url');
		} catch {
			// A blocked store must not stop the navigation below.
		}
		// Only when something actually sent them here. Signing in from the
		// swap screen should leave them on the swap screen.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-origin URL validated above
		if (target) goto(target);
	});
</script>

{#if $connectOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="login-overlay" onclick={closeConnect}>
		<div class="login-modal" onclick={(e) => e.stopPropagation()}>
			<button class="modal-close" onclick={closeConnect}><X size={20} /></button>
			<img src="/altera_med.png" alt="" class="modal-logo" />
			<h2 class="login-title">Connect to Altera</h2>
			<p class="login-subtitle">Choose how you want to connect</p>
			{#if redirectTo && redirectTo.pathname != '/'}
				<p class="continue">
					Continue to <span class="redirect">{redirectTo.pathname}</span>
				</p>
			{/if}
			<div class="login-option evm">
				<div class="option-left">
					<Wallet size={20} />
					<div class="option-text">
						<span class="option-label">EVM Wallet</span>
						<span class="option-hint">MetaMask · Coinbase · WalletConnect</span>
					</div>
				</div>
				<div class="option-right">
					<ArrowRight size={16} class="option-arrow" />
				</div>
				<div class="option-button" onclick={() => setTimeout(closeConnect, 100)}>
					<AppKitLogin namespace="eip155" />
				</div>
			</div>
			<div class="login-option btc">
				<div class="option-left">
					<Bitcoin size={20} />
					<div class="option-text">
						<span class="option-label">BTC Wallet</span>
						<span class="option-hint">Leather · Xverse · Unisat · OKX</span>
					</div>
				</div>
				<div class="option-right">
					<ArrowRight size={16} class="option-arrow" />
				</div>
				<div class="option-button" onclick={() => setTimeout(closeConnect, 100)}>
					<AppKitLogin namespace="bip122" />
				</div>
			</div>
			<div class="login-divider">
				<span>or</span>
			</div>
			<div class="hive-login-wrap">
				<HiveLogin />
			</div>
			<div class="modal-footer">
				<div class="powered-footer">
					<span>Powered by</span>
					<img src="/magi-with-name.svg" alt="Magi Network" />
				</div>
				<span class="custody-note">Non-custodial · Your keys, your assets</span>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.login-overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		animation: overlayIn 0.2s ease;
	}
	@keyframes overlayIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.login-modal {
		position: relative;
		max-width: 400px;
		width: calc(100% - 2rem);
		background:
			radial-gradient(ellipse at 50% 30%, rgba(99, 88, 255, 0.08) 0%, transparent 70%), #0f1225;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 2rem 1.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0 0 60px rgba(99, 88, 255, 0.15);
		animation: modalIn 0.2s ease;
	}
	@keyframes modalIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.modal-logo {
		width: 32px;
		height: 32px;
		filter: invert(1) brightness(2);
		margin-bottom: 0.75rem;
	}
	.modal-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 50%;
		display: flex;
		transition: color 0.15s;
		&:hover {
			color: white;
		}
	}
	.login-title {
		text-align: center;
		margin: 0 0 0.25rem;
		font-size: 1.25rem;
		font-weight: 700;
	}
	.login-subtitle {
		text-align: center;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.4);
		margin: 0 0 1.5rem;
	}
	.continue {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.5);
		margin: -0.5rem 0 1rem;
	}
	.redirect {
		font-family: 'Noto Sans Mono Variable', monospace;
		color: #7b74ff;
		text-decoration: underline;
	}

	/* ── Login options ── */
	.login-option {
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
			border-color: rgba(99, 88, 255, 0.5);
			box-shadow: 0 0 20px rgba(99, 88, 255, 0.1);
		}
	}
	.option-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.option-text {
		display: flex;
		flex-direction: column;
	}
	.option-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--dash-text-primary, white);
	}
	.option-hint {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.3);
		margin-top: 0.1rem;
	}
	.option-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgba(255, 255, 255, 0.25);
	}
	/* Web3 button overlay covers entire card */
	.option-button {
		position: absolute;
		inset: 0;
		z-index: 1;
		cursor: pointer;
		:global(button) {
			background: transparent !important;
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			margin: 0 !important;
			height: 100% !important;
			width: 100% !important;
			color: transparent !important;
			cursor: pointer;
		}
	}
	/* Hive login - styled to match EVM card */
	.hive-login-wrap {
		width: 100%;
		:global(button) {
			width: 100% !important;
			background: #1a1f35 !important;
			border: 1px solid rgba(255, 255, 255, 0.08) !important;
			border-radius: 12px !important;
			padding: 0.875rem 1rem !important;
			color: white !important;
			font-family: 'Nunito Sans', sans-serif !important;
			font-weight: 600 !important;
			font-size: 0.9rem !important;
			box-shadow: none !important;
			transition:
				border-color 0.15s ease,
				box-shadow 0.15s ease !important;
			&:hover {
				border-color: rgba(99, 88, 255, 0.5) !important;
				box-shadow: 0 0 20px rgba(99, 88, 255, 0.1) !important;
			}
		}
	}

	/* ── Divider ── */
	.login-divider {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 0.75rem;
		margin: 0.75rem 0;
		span {
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.25);
			white-space: nowrap;
		}
		&::before,
		&::after {
			content: '';
			flex: 1;
			height: 1px;
			background: rgba(255, 255, 255, 0.08);
		}
	}

	/* ── Modal footer ── */
	.modal-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 1.25rem;
		gap: 0.35rem;
	}
	.powered-footer {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		span {
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.3);
		}
		img {
			height: 18px;
			opacity: 0.5;
		}
	}
	.custody-note {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.2);
		letter-spacing: 0.02em;
	}
</style>
