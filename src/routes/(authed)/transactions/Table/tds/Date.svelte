<script lang="ts">
	import moment from 'moment';

	const { block_height }: { block_height: string } = $props();
	const START_BLOCK = 88079516;
	const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');
	function getDateFromBlockHeight(blockHeight: number) {
		const date =
			(blockHeight - START_BLOCK) * 3 < 0
				? START_BLOCK_TIME.clone().subtract(-(blockHeight - START_BLOCK) * 3, 'seconds')
				: START_BLOCK_TIME.clone().add((blockHeight - START_BLOCK) * 3, 'seconds');
		return date;
	}
</script>

<td class="date">
	{getDateFromBlockHeight(Number.parseInt(block_height)).format('MMM D')}
</td>

<style>
	td {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);
		width: max-content;

		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	.date {
		width: 5rem;
	}
</style>
