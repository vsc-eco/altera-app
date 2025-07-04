<script lang="ts">
	import { Dot } from "@lucide/svelte";

	type Props = {
		label: string;
		display?: string[];
		disabled?: boolean;
		tall?: boolean;
	};
	let { label, display, disabled = false, tall = false }: Props = $props();
</script>

<div class={{tall}}>
	<span class={{ disabled }}>{label}</span>

	{#if display}
		<ul class={{ disabled, tall }}>
			{#each display as item, index}
				<li>{item}</li>
				{#if index < display.length - 1 && !tall}
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
	ul.tall {
		padding-top: 0.5rem;
	}
	.tall {
		flex-direction: column;
		align-items: start;
	}
	span.disabled {
		color: var(--neutral-mid);
	}
</style>
