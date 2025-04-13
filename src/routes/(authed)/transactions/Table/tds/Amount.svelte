<script lang="ts">
	type Props = { fromOrTo: 'from' | 'to' | string; amount: string };
	let { fromOrTo, amount }: Props = $props();
</script>

<td>
	<span
		class={[
			'amount',
			{
				primary: fromOrTo == 'from',
				secondary: fromOrTo == 'to'
			}
		]}
	>
		{#if Number.parseFloat(amount)}
			{#if fromOrTo == 'from'}
				+
			{:else if fromOrTo == 'to'}
				-
			{/if}{new Intl.NumberFormat().format(Number.parseFloat(amount))}
		{:else}
			invalid
		{/if}
	</span>
</td>

<style>
	.amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		color: var(--fg-mid);
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}
</style>
