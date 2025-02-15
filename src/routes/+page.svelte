<script>
	import Balance from '$lib/cards/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { actions } from './quickActions';
</script>

<h1>Welcome, Name</h1>
{#each actions as action}
	<PillBtn {...'styling' in action ? action.styling : {}} href={action.href}>
		{@const Icon = action.icon}
		<Icon />
		{action.label}
	</PillBtn>
{/each}
<Balance></Balance>
