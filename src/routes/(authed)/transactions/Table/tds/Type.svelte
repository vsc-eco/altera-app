<script lang="ts">
	import { ArrowRight, ArrowLeft } from '@lucide/svelte';
	let { isIncoming, t }: { isIncoming: boolean; t: string } = $props();
</script>

<td>
	<span class="type">
		{#if isIncoming}
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
