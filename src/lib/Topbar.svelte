<script lang="ts">
	import { Bell, Icon } from 'lucide-svelte';
	import { actions } from '../routes/quickActions';
	import Menu from '$lib/zag/Menu.svelte';
	import Search from './Search.svelte';
	import { goto } from '$app/navigation';
	import PillButton from './PillButton.svelte';
	import Avatar from './zag/Avatar.svelte';
	import { MenuIcon } from '@lucide/svelte';
	let { onMenuToggle } = $props();
</script>

{#snippet option(a: { label: string; icon: typeof Icon })}
	{@const Icon = a.icon}
	<span class="icon">
		<Icon></Icon>
	</span>
	{a.label}
{/snippet}
<header>
	<!-- <img src="/vsc.png" alt="VSC Logo" width="48" />
	<h2>DeFi</h2> -->
	<button class="icon" onclick={onMenuToggle}> <MenuIcon></MenuIcon> </button>
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
	<PillButton onclick={() => {}} style="icon"><Bell /></PillButton>
	<Avatar fallback="ZP"></Avatar>
</header>

<style>
	header {
		display: flex;
		justify-content: left;
		gap: 0.5rem;
		align-items: center;
	}
	.icon {
		margin-right: 0.5rem;
	}
</style>
