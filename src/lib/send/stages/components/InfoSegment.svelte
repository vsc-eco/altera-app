<script lang="ts">
	import { Dot } from "@lucide/svelte";

	type Props = {
		label: string;
		display?: string[];
		disabled?: boolean;
		size?: 'small' | 'medium' | 'large';
	};
	let { label, display, disabled = false, size = 'small' }: Props = $props();
</script>

<div class={{stacked: size !== 'small'}}>
	<span class={{ disabled }}>{label}</span>

	{#if display}
		<ul class={{ disabled, stacked: size === 'large' }}>
			{#each display as item, index}
				<li>{item}</li>
				{#if index < display.length - 1 && size !== 'large'}
					<Dot />
				{/if}
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-grow: 1;
	}
	ul {
		text-align: left;
		display: flex;
		align-items: center;
		line-height: 1.2;
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	ul.disabled {
		color: var(--secondary-bg-mid);
	}
	ul.stacked {
		padding-top: 0.5rem;
	}
	.stacked {
		flex-direction: column;
		align-items: start;
	}
	span.disabled {
		color: var(--neutral-mid);
	}
</style>
