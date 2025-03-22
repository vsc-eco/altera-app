<script lang="ts">
	import { actions } from '../routes/quickActions';
	import Menu from '$lib/zag/Menu.svelte';
	import Search from './Search.svelte';
	import { goto } from '$app/navigation';
	import PillButton from './PillButton.svelte';
	import Avatar from './zag/Avatar.svelte';
	import { Bell, Component, MenuIcon } from '@lucide/svelte';
	import { authStore } from './auth/store';
	let { onMenuToggle } = $props();
	let username: string = $state('  ');
	let logout: () => Promise<void> = async () => {};
	let openSettings: () => void = () => {};
	$effect(() => {
		authStore.subscribe((v) => {
			if (!v.value) return;
			username = v.value.username || v.value.address?.slice(2) || '**';
			logout = v.value.logout;
			openSettings = v.value.openSettings;
		});
	});
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
	<Search></Search>
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
	<PillButton onclick={() => {}} styleType="icon"><Bell /></PillButton>
	{#snippet prefs(name: string)}
		{name}
	{/snippet}
	<Menu
		label="Account Settings"
		styleType="icon"
		items={[
			{ label: 'prefs', snippet: prefs, snippetData: 'Account Preferences' },
			{ label: 'logout', snippet: prefs, snippetData: 'Logout' }
		]}
		onSelect={async (e) => {
			switch (e.value) {
				case 'logout':
					await logout();
					goto('/logout');
					break;
				case 'prefs':
					openSettings();
					break;
				default:
					console.warn('unknown action triggered in avatar dropdown');
			}
		}}
	>
		<Avatar fallback={username.slice(0, 2).toLocaleUpperCase()}></Avatar>
	</Menu>
</header>

<style>
	header {
		display: flex;
		justify-content: left;
		gap: 0.25rem;
		align-items: center;
		margin: auto;
	}
	@media screen and (min-width: 560px) {
		button.transparent-icon {
			display: none;
		}
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
