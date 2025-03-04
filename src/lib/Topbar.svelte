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
	let username: string | undefined = $state('  ');
	$effect(() => {
		authStore.subscribe((v) => {
			if (!v.value) return;
			username = v.value.username || v.value.address || 'AA';
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
	></Menu>
	<PillButton onclick={() => {}} styleType="icon"><Bell /></PillButton>
	{#if username != undefined}
		<Avatar fallback={username.slice(0, 2).toLocaleUpperCase()}></Avatar>
	{/if}
</header>

<style>
	header {
		display: flex;
		justify-content: left;
		gap: 0.5rem;
		align-items: center;
		max-width: 800px;
		margin: auto;
	}
	.icon {
		margin-right: 0.5rem;
	}
</style>
