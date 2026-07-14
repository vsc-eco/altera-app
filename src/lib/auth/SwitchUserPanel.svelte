<!--
	Hive account switcher — the panel behind "Switch user".

	Lists the active Hive account plus every other connected login that Aioha
	keeps in its persistent multi-login storage (getOtherLogins), switches with
	aioha.switchUser (the auth store follows via the existing account_changed
	handler, which also clears account-scoped data), lets the user connect
	another account (embedded HiveLogin) and remove remembered ones. Full
	logout lives at the bottom. Requested by jux.
-->
<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import Avatar from '$lib/zag/Avatar.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import HiveLogin from './HiveLogin.svelte';
	import { getAuth } from './store';
	import { switchUserPanelOpen } from './switchUserStore';
	import { Check, LogOut, X } from '@lucide/svelte';

	const auth = $derived(getAuth()());
	const username = $derived(auth.value?.username);
	const aioha = $derived(auth.value?.aioha);

	let open = $state(false);
	let toggle = $state<(o?: boolean) => void>(() => {});

	// Store → dialog (open requests from sidebar/topbar) and dialog → store
	// (user dismissed with Esc/X/backdrop). The dialog→store direction must
	// only react to a CLOSE TRANSITION (previous-value tracker, same pattern
	// as ReviewSwap): a level check like `!open && $store` fires in the gap
	// between the store going true and the dialog actually opening, and
	// cancels the open before it happens.
	$effect(() => {
		const want = $switchUserPanelOpen;
		if (want !== open) toggle(want);
	});
	let lastOpen = false;
	$effect(() => {
		if (open === lastOpen) return;
		lastOpen = open;
		if (!open) switchUserPanelOpen.set(false);
	});

	// Other connected accounts. Re-read when the panel opens or the active
	// user changes (post-switch / post-add); `bump` covers removals.
	let bump = $state(0);
	const others = $derived.by(() => {
		void bump;
		void username;
		if (!open || !aioha) return [];
		return Object.entries(aioha.getOtherLogins()).map(([name, provider]) => ({
			name,
			provider: String(provider)
		}));
	});

	let switchError = $state('');
	function switchTo(name: string) {
		switchError = '';
		if (!aioha) return;
		// account_changed updates the auth store and clears account-scoped data.
		const ok = aioha.switchUser(name);
		if (!ok) {
			switchError = `Couldn't switch to @${name} — its session may have expired. Remove it and connect again.`;
			return;
		}
		switchUserPanelOpen.set(false);
	}

	function remove(name: string) {
		switchError = '';
		aioha?.removeOtherLogin(name);
		bump++;
	}

	async function logoutAll() {
		switchUserPanelOpen.set(false);
		await auth.value?.logout?.();
	}
</script>

<Dialog bind:open bind:toggle>
	{#snippet title()}Switch user{/snippet}
	{#snippet content()}
		<div class="switch-panel">
			<ul class="accounts">
				{#if username}
					<li class="account current">
						<Avatar did={`hive:${username}`} fallback="" size="small" />
						<span class="name">@{username}</span>
						<span class="current-badge"><Check size={12} /> Current</span>
					</li>
				{/if}
				{#each others as other (other.name)}
					<li class="account">
						<button type="button" class="switch-btn" onclick={() => switchTo(other.name)}>
							<Avatar did={`hive:${other.name}`} fallback="" size="small" />
							<span class="name">@{other.name}</span>
							<span class="provider">{other.provider}</span>
						</button>
						<button
							type="button"
							class="remove-btn"
							title="Forget this account"
							aria-label="Forget @{other.name}"
							onclick={() => remove(other.name)}
						>
							<X size={14} />
						</button>
					</li>
				{/each}
			</ul>

			{#if others.length === 0}
				<p class="empty">No other accounts connected yet.</p>
			{/if}

			{#if switchError}
				<p class="error">{switchError}</p>
			{/if}

			<!-- HiveLogin brings its own trigger + dialog; a successful login makes
			     the new account active and Aioha keeps the previous one connected. -->
			<div class="add-account">
				<HiveLogin />
			</div>

			<div class="panel-footer">
				<PillButton onclick={logoutAll} styleType="outline" theme="secondary">
					<LogOut size={14} />
					Log out
				</PillButton>
			</div>
		</div>
	{/snippet}
</Dialog>

<style lang="scss">
	.switch-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: min(22rem, 85vw);
	}
	.accounts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 12px;
	}
	.account.current {
		padding: 0.6rem 0.75rem;
		background: rgba(111, 106, 248, 0.1);
		border-color: rgba(111, 106, 248, 0.5);
	}
	.switch-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: none;
		border: none;
		font: inherit;
		color: var(--dash-text-primary);
		cursor: pointer;
		text-align: left;
		border-radius: 12px;
		min-width: 0;
	}
	.switch-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.provider {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		text-transform: capitalize;
	}
	.current-badge {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--dash-accent-green);
	}
	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		margin-right: 0.5rem;
		border: none;
		background: none;
		color: var(--dash-text-muted);
		cursor: pointer;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.remove-btn:hover {
		color: var(--dash-text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
	.empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--dash-text-muted);
	}
	.error {
		margin: 0;
		font-size: 0.85rem;
		color: var(--dash-accent-red, #dc2626);
	}
	.add-account :global([data-part='trigger']) {
		width: 100%;
	}
	.panel-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.75rem;
		border-top: 1px solid var(--dash-card-border);
	}
</style>
