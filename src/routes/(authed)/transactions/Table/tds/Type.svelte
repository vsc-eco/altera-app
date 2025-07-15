<script lang="ts">
	import { ArrowRight, ArrowLeft } from '@lucide/svelte';
	let { outgoing, t }: { outgoing: boolean; t: string } = $props();
</script>

<td>
	<span class="type">
		{#if outgoing}
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
