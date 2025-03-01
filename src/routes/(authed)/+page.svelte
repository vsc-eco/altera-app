<script>
	import Balance from '$lib/cards/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { actions } from '../quickActions';
</script>

<h1>Welcome, Name</h1>
<div class="action-bar">
	{#each actions as action}
		<PillBtn {...'styling' in action ? action.styling : {}} href={action.href}>
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>
<Balance></Balance>

<style>
	.action-bar {
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		height: 3rem;
		white-space: nowrap;
		position: relative;
	}
	.action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
	}
</style>
