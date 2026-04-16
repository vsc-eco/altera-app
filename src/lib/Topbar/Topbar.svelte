<script lang="ts">
	import Menu from '$lib/zag/Menu.svelte';
	import { goto } from '$app/navigation';
	import Notifications from './Notifications.svelte';
	import Avatar from '../zag/Avatar.svelte';
	import CommandPalette from './CommandPalette.svelte';
	import { Component, MenuIcon, Search, Bell } from '@lucide/svelte';
	import { getAuth } from '../auth/store';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { onMount } from 'svelte';
	let { onMenuToggle } = $props();
	let paletteOpen = $state(false);

	onMount(() => {
		function handleGlobalKeydown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				paletteOpen = !paletteOpen;
			}
		}
		window.addEventListener('keydown', handleGlobalKeydown);
		return () => window.removeEventListener('keydown', handleGlobalKeydown);
	});
	let auth = $derived(getAuth()());
	let username: string = $derived.by(() => {
		if (!auth.value) return '  ';
		return auth.value.username || auth.value.address?.slice(2) || '**';
	});
	let [logout, openSettings, gotoPreferences] = $derived.by(() => {
		if (auth.value) {
			return [
				auth.value.logout,
				auth.value.openSettings,
				() => { goto('/preferences'); }
			];
		} else {
			return [async () => {}, () => {}, () => { goto('/preferences'); }];
		}
	});
	let src = $derived(auth.value?.profilePicUrl);
	let bal = $derived($accountBalance.bal);
	let rcDisplay = $derived.by(() => {
		if (!bal) return 'MAGI RC: 0 / 12,500';
		const rc = bal.hbd || 0;
		const maxRc = 12500;
		return `MAGI RC: ${rc.toLocaleString()} / ${maxRc.toLocaleString()}`;
	});
</script>

{#snippet option(a: { label: string; icon: typeof Component })}
	{@const Icon = a.icon}
	<span class="icon"><Icon /></span>
	{a.label}
{/snippet}

<header>
	<button class="transparent-icon mobile-menu" onclick={onMenuToggle}>
		<MenuIcon />
	</button>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="search-bar" onclick={() => (paletteOpen = true)}>
		<Search size={16} />
		<span class="search-placeholder">Search or jump to…</span>
		<kbd class="search-kbd">⌘K</kbd>
	</div>

	<div class="topbar-right">
		<div class="rc-badge">
			<span class="rc-text">{rcDisplay}</span>
		</div>

		<Notifications />

		<Menu
			label="Account Settings"
			styleType="icon"
			items={[
				{ label: 'acc-prefs', snippet: option, snippetData: { label: 'Account Preferences', icon: Component } },
				{ label: 'app-prefs', snippet: option, snippetData: { label: 'App Preferences', icon: Component } },
				{ label: 'logout', snippet: option, snippetData: { label: 'Logout', icon: Component } }
			]}
			onSelect={async (e) => {
				switch (e.value) {
					case 'logout': await logout(); break;
					case 'acc-prefs': openSettings(); break;
					case 'app-prefs': gotoPreferences(); break;
				}
			}}
		>
			<Avatar did={auth.value?.did} fallback=""></Avatar>
		</Menu>
	</div>
</header>

<CommandPalette bind:open={paletteOpen} />

<style lang="scss">
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 0;
		margin-top: 2vh;
		z-index: 10;
		width: 100%;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 0 1 360px;
		height: 40px;
		padding: 0 1rem;
		background-color: var(--dash-topbar-search-bg);
		border: 1px solid var(--dash-topbar-search-border);
		border-radius: 20px;
		color: var(--dash-text-muted);
		transition: border-color 0.15s;
	}
	.search-bar:focus-within {
		border-color: var(--dash-accent-purple);
	}
	.search-bar {
		cursor: pointer;
	}
	.search-placeholder {
		flex: 1;
		font-size: 0.875rem;
		color: var(--dash-text-muted);
	}
	.search-kbd {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 4px;
		font-size: 0.65rem;
		color: var(--dash-text-muted);
		background: rgba(255, 255, 255, 0.05);
		font-family: inherit;
	}
	.search-bar :global(svg) {
		flex-shrink: 0;
		color: var(--dash-text-muted);
	}
	.topbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.rc-badge {
		display: flex;
		align-items: center;
		height: 40px;
		padding: 0 1rem;
		background-color: var(--dash-topbar-badge-bg);
		border: 1px solid var(--dash-topbar-badge-border);
		border-radius: 20px;
		white-space: nowrap;
	}
	.rc-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--dash-text-secondary);
	}

	.mobile-menu {
		display: none;
	}
	@media screen and (max-width: 620px) {
		.mobile-menu {
			display: flex;
		}
		.rc-badge {
			display: none;
		}
	}

	.icon {
		margin-right: 0.5rem;
	}
</style>
