<script lang="ts">
	import { getDateFromBlockHeight } from '../../getDateFromBlockHeight';

	const { block_height }: { block_height: string } = $props();
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
		min-width: 4rem;
	}
</style>
