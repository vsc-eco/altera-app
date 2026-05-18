<script lang="ts">
	import { browser } from '$app/environment';
	import { X, RefreshCw } from '@lucide/svelte';

	/**
	 * Checks /api/version once on mount and again whenever the tab
	 * becomes visible (user returning to the app). If the server's
	 * version differs from the one baked into this JS bundle, a toast
	 * appears prompting the user to refresh.
	 *
	 * Rationale: constant polling is wasteful — users only act on the
	 * toast when they're looking at the page anyway. Checking on
	 * `visibilitychange` covers "I left this tab open all day and came
	 * back" without burning requests every two minutes.
	 *
	 * Svelte notes:
	 * - `$state` for the reactive `show` flag — toggles the toast.
	 * - `$effect` to attach/detach the visibilitychange listener tied
	 *   to the component lifecycle (auto-cleanup on destroy).
	 */

	const currentVersion = __APP_VERSION__;
	const CHANGELOG_URL = 'https://github.com/vsc-eco/altera-app/blob/main/CHANGELOG.md';

	let show = $state(false);
	let newVersion = $state('');

	function dismiss() {
		show = false;
	}

	function refresh() {
		window.location.reload();
	}

	$effect(() => {
		if (!browser) return;

		async function checkVersion() {
			try {
				const res = await fetch('/api/version', { cache: 'no-cache' });
				if (!res.ok) return;
				const data = await res.json();
				if (data.version && data.version !== currentVersion) {
					newVersion = data.version;
					show = true;
				}
			} catch {
				// Network error — silently ignore, will retry on next visibility change
			}
		}

		function onVisibilityChange() {
			if (document.visibilityState === 'visible') checkVersion();
		}

		// Initial check after a short delay (don't block initial load).
		const timeout = setTimeout(checkVersion, 10_000);
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			clearTimeout(timeout);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});
</script>

{#if show}
	<div class="update-toast" role="alert">
		<div class="toast-content">
			<RefreshCw size={16} class="toast-icon" />
			<div class="toast-text">
				<span class="toast-title">New version available</span>
				<span class="toast-detail">
					Refresh to get the latest features.
					<a href={CHANGELOG_URL} target="_blank" rel="noreferrer">What's new?</a>
				</span>
			</div>
		</div>
		<div class="toast-actions">
			<button class="toast-refresh" onclick={refresh}>Refresh</button>
			<button class="toast-dismiss" onclick={dismiss} aria-label="Dismiss">
				<X size={14} />
			</button>
		</div>
	</div>
{/if}

<style lang="scss">
	.update-toast {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 9999;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: #1a1a2e;
		border: 1px solid rgba(111, 106, 248, 0.4);
		border-radius: 14px;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(111, 106, 248, 0.1);
		animation: toast-in 0.3s ease-out;
		max-width: 400px;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toast-content {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		flex: 1;
		min-width: 0;

		:global(.toast-icon) {
			flex-shrink: 0;
			color: #6f6af8;
			margin-top: 0.125rem;
		}
	}

	.toast-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.toast-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-primary, #e8e8f0);
	}

	.toast-detail {
		font-size: 0.75rem;
		color: var(--dash-text-muted, #8888a0);
		a {
			color: #6f6af8;
			text-decoration: none;
			font-weight: 500;
			&:hover {
				text-decoration: underline;
			}
		}
	}

	.toast-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.toast-refresh {
		padding: 0.35rem 0.75rem;
		border: none;
		border-radius: 8px;
		background: #6f6af8;
		color: #fff;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s;
		&:hover {
			background: #5b56e0;
		}
	}

	.toast-dismiss {
		all: unset;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		color: var(--dash-text-muted, #8888a0);
		cursor: pointer;
		transition: background-color 0.15s;
		&:hover {
			background: rgba(255, 255, 255, 0.08);
			color: var(--dash-text-primary, #e8e8f0);
		}
	}

	@media screen and (max-width: 480px) {
		.update-toast {
			left: 1rem;
			right: 1rem;
			bottom: 1rem;
			max-width: unset;
		}
	}
</style>
