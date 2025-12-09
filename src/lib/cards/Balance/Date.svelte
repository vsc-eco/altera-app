<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import moment from 'moment';
	export type DateRange = { label: string; start: Date; end: Date };
	type Props = {
		dateRanges?: DateRange[];
		currDate?: Date;
		hourly?: boolean;
		onValueChange: (v: DateRange) => void;
	};
	let { dateRanges = [], currDate, hourly, onValueChange: onRangeChange }: Props = $props();
	let initial: string = $derived(dateRanges[0].label);
</script>

{#if currDate}
	{#if moment(currDate).minutes() !== 0}
		Now
	{:else if hourly}
		{moment(currDate).format('MMMM D, YYYY, HH:mm')}
	{:else}
		{moment(currDate).format('MMMM D, YYYY')}
	{/if}
{/if}
<!-- style as hidden instead of {:else} to avoid recreating -->
<div class="select-wrapper" hidden={!!currDate}>
	<Select
		onValueChange={(v) => {
			initial = v.value[0];
			onRangeChange(v.items[0]);
		}}
		{initial}
		items={dateRanges}
	></Select>
</div>

<style>
	.select-wrapper[hidden] {
		visibility: hidden;
	}
</style>
