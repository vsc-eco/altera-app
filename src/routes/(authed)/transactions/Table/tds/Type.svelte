<script lang="ts">
	import { ArrowRight, ArrowLeft, ArrowRightLeft, NotebookPen } from '@lucide/svelte';
	let { direction, t }: { direction: 'incoming' | 'outgoing' | 'swap' | 'contract'; t: string } = $props();
</script>

<td>
	<span class="type">
		{#if direction === 'outgoing'}
			<ArrowRight />
		{:else if direction === 'swap'}
			<ArrowRightLeft />
		{:else if direction === 'incoming'}
			<ArrowLeft />
		{:else}
			<NotebookPen />
		{/if}

		{t.replaceAll('_', ' ')}
	</span>
</td>

<style>
	.type {
		display: inline-flex;
		justify-content: left;
		gap: 0.25rem;
		align-items: center;
	}
</style>
