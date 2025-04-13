<script lang="ts">
	type Props = {
		fromOrTo: string;
		tk: string;
		amount: string;
	};
	let { fromOrTo, tk, amount }: Props = $props();
</script>

<td>
	<span
		class={[
			'token',
			{
				primary: fromOrTo == 'from',
				secondary: fromOrTo == 'to'
			}
		]}
	>
		{#if Number.parseFloat(amount)}
			{tk.toUpperCase()}
		{/if}
	</span>
</td>

<style>
	.token {
		color: var(--fg-mid);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
	}

	td:has(.token) {
		padding-left: 0;
	}
</style>
