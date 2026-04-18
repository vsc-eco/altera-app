<script lang="ts">
	import PillBtn from '$lib/PillButton.svelte';
	import { actions, type NavigationAction } from '../quickActions';
	import type { Auth } from '$lib/auth/store';
	let { auth }: { auth: Auth } = $props();
	const menuActions: NavigationAction[] = [];
</script>

<div class="action-bar" tabindex="-1">
	{#each menuActions as action}
		<PillBtn
			{...(action.styling ?? {})}
			href={action.href}
		>
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>

<style>
	.action-bar {
		max-width: 100%;
		overflow-x: auto;
		padding-top: 2px;
		height: 3.5rem;
		white-space: nowrap;
		position: relative;
		font-family: 'Nunito Sans', sans-serif;
	}
	/* .action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3.5rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
	} */
</style>
