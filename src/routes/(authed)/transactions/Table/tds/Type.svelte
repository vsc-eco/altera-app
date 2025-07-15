<script lang="ts">
	import { ArrowRight, ArrowLeft, ArrowRightLeft } from '@lucide/svelte';
	let { direction, t }: { direction: 'incoming' | 'outgoing' | 'swap'; t: string } = $props();
</script>

<td>
	<span class="type">
		{#if direction === 'outgoing'}
			<ArrowRight />
		{:else if direction === 'swap'}
			<ArrowRightLeft />
		{:else}
			<ArrowLeft />
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
