<script lang="ts">
	import { Dot } from '@lucide/svelte';

	type Props = {
		label: string;
		display?: string[];
		disabled?: boolean;
		size?: 'small' | 'medium' | 'large';
	};
	let { label, display, disabled = false, size = 'small' }: Props = $props();
</script>

<div class={{ stacked: size !== 'small' }}>
	<span class={{ disabled }}>{label}</span>

	{#if display}
		<!-- Call this stacked and not large so it reuses class from warpper div -->
		<ul class={{ disabled, medium: size === 'medium', stacked: size === 'large' }}>
			{#each display as item, index}
				<li>{item}</li>
				{#if index < display.length - 1 && size !== 'large'}
					<span class="dot-wrapper"><Dot /></span>
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
		.dot-wrapper {
			height: 1rem;
			display: flex;
			align-items: center;
		}
	}
	ul.disabled {
		color: var(--secondary-bg-mid);
	}
	ul.medium {
		padding-top: 0.25rem;
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
