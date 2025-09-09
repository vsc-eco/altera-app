<script lang="ts">
	import { actions } from '../../routes/quickActions';
	import Menu from '$lib/zag/Menu.svelte';
	import { goto } from '$app/navigation';
	import Notifications from './Notifications.svelte';
	import Avatar from '../zag/Avatar.svelte';
	import { Component, MenuIcon } from '@lucide/svelte';
	import { getAuth } from '../auth/store';
	import ComboSearch from '../zag/Search/ComboSearch.svelte';
	let { onMenuToggle } = $props();
	let auth = $derived(getAuth()());
	let username: string = $derived.by(() => {
		if (!auth.value) return '  ';
		let out = auth.value.username || auth.value.address?.slice(2) || '**';
		return out;
	});
	let [logout, openSettings, gotoPreferences] = $derived.by(() => {
		if (auth.value) {
			return [
				auth.value.logout,
				auth.value.openSettings,
				() => {
					goto('/preferences');
				}
			];
		} else {
			return [
				async () => {},
				() => {},
				() => {
					goto('/preferences');
				}
			];
		}
	});
	let src = $derived(auth.value?.profilePicUrl);
</script>

{#snippet option(a: { label: string; icon: typeof Component })}
	{@const Icon = a.icon}
	<span class="icon">
		<Icon></Icon>
	</span>
	{a.label}
{/snippet}
<header>
	<!-- <img src="/vsc.png" alt="VSC Logo" width="48" />
	<h2>DeFi</h2> -->
	<button class="transparent-icon" onclick={onMenuToggle}> <MenuIcon></MenuIcon> </button>
	<ComboSearch />

	<Menu
		items={actions.map((a) => {
			return {
				label: a.label,
				snippet: option,
				snippetData: a
			};
		})}
		label="Move Money"
		onSelect={(e: { value: string }) => {
			let action = actions.find((v) => v.label == e.value)!;
			goto(action.href);
		}}
	/>
	<Notifications />
	{#snippet prefs(name: string)}
		{name}
	{/snippet}
	<Menu
		label="Account Settings"
		styleType="icon"
		items={[
			{ label: 'acc-prefs', snippet: prefs, snippetData: 'Account Preferences' },
			{ label: 'app-prefs', snippet: prefs, snippetData: 'App Preferences' },
			{ label: 'logout', snippet: prefs, snippetData: 'Logout' }
		]}
		onSelect={async (e) => {
			switch (e.value) {
				case 'logout':
					await logout();
					break;

				case 'acc-prefs':
					openSettings();
					break;
				case 'app-prefs':
					gotoPreferences();
					break;
				default:
					console.warn('unknown action triggered in avatar dropdown');
			}
		}}
	>
		<Avatar did={auth.value?.did} fallback=""></Avatar>
	</Menu>
</header>

<style>
	header {
		display: flex;
		justify-content: left;
		gap: 0.25rem;
		align-items: center;
		margin: calc(var(--text-4xl) / 2) auto;
		z-index: 10;
		width: 100%;
		overflow-x: auto;
	}
	@media screen and (max-width: 420px) {
		header {
			justify-content: space-between;
			gap: 0.125rem;
		}
	}
	.icon {
		margin-right: 0.5rem;
	}
</style>
