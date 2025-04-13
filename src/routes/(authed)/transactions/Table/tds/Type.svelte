<script lang="ts">
	import { ArrowRight, ArrowLeft } from '@lucide/svelte';
	let { fromOrTo, t }: { fromOrTo: string, t: string } = $props();
</script>

<td>
	<span class="type">
		{#if fromOrTo == 'from'}
			<ArrowRight />
		{:else}
			<ArrowLeft></ArrowLeft>
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
