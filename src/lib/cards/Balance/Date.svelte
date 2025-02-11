<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import moment from 'moment';
	export type DateRange = { label: string; start: Date; end: Date };
	type Props = {
		dateRanges?: DateRange[];
		currDate?: Date;
		onValueChange: (v: DateRange) => void;
	};
	let { dateRanges = [], currDate, onValueChange: onRangeChange }: Props = $props();
	let initial: string = $state(dateRanges[0].label);
</script>

{#if currDate}
	{moment(currDate).format('MMMM D, YYYY')}
{:else}
	<Select
		onValueChange={(v) => {
			initial = v.value[0];
			onRangeChange(v.items[0] as DateRange);
		}}
		{initial}
		options={dateRanges}
	></Select>
{/if}
