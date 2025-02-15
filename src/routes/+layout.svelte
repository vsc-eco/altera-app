<script lang="ts">
	import type { Icon } from 'lucide-svelte';
	import '../styles/reset.css';
	import '../styles/colors.scss';
	import '../styles/base.scss';
	let { children } = $props();
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import Select from '$lib/zag/Select.svelte';
	import { actions } from './quickActions';
	import Menu from '$lib/zag/Menu.svelte';
</script>

{#snippet option(a: { label: string; icon: typeof Icon })}
	{@const Icon = a.icon}
	<span class="asdf">
		<Icon></Icon>
	</span>
	{a.label}
{/snippet}
<header>
	<!-- <img src="/vsc.png" alt="VSC Logo" width="48" />
	<h2>DeFi</h2> -->
	<form action="none">
		<input type="search" />
	</form>
	<Menu
		items={actions.map((a) => {
			return {
				label: a.label,
				snippet: option,
				snippetData: a
			};
		})}
		initial="Move Money"
	></Menu>
</header>
{@render children()}

<style>
	img {
		display: block;
		height: 2.83rem;
	}
	header {
		display: flex;
		justify-content: left;
		gap: 0.5rem;
	}
	.asdf {
		padding-right: 1rem;
	}
</style>
