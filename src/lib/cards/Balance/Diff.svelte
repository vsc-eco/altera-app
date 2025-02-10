<script lang="ts">
	import { ArrowDownRight, ArrowUpRight } from 'lucide-svelte';
	type Props = {
		up: number;
		down: number;
		compact?: boolean;
	};
	let props: Props = $props();
	let formatter = $derived(
		new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			notation: props.compact ? 'compact' : undefined,
			minimumFractionDigits: !props.compact ? 2 : undefined
		})
	);
</script>

{#snippet format(num: number)}
	{formatter.format(num)}
{/snippet}

{#snippet arrow(v: 'up' | 'down')}
	<span class={v}>
		{#if v == 'up'}
			<ArrowUpRight />
		{:else}
			<ArrowDownRight />
		{/if}
		{@render format(props[v])}
	</span>
{/snippet}

<div>
	{#if props.up > 0}
		{@render arrow('up')}
	{/if}
	{#if props.down > 0}
		{@render arrow('down')}
	{/if}
	{#if props.up == 0 && props.down == 0}
		{@render arrow('up')}
	{/if}
</div>

<style>
	span {
		display: inline-flex;
		align-items: center;
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	div {
		display: inline-flex;
		gap: 0.5rem;
	}
	div :global(svg) {
		height: 14px;
		width: 14px;
		padding: none;
		overflow: hidden;
	}
	.up {
		color: var(--primary-fg-mid);
	}
	.down {
		color: var(--secondary-fg-mid);
	}
</style>
