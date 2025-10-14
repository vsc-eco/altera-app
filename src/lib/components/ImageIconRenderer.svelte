<script lang="ts">
	import type { Dot } from '@lucide/svelte';

	type Props = {
		icon: ImageIconOption;
		color?: string;
		alt?: string;
		size?: number;
	};
	let { icon, color, alt, size = 24 }: Props = $props();

	export type ImageIconOption = string | typeof Dot;
</script>

{#if typeof icon === 'string'}
	<div class="square" style="--size: {size}px;">
		<img src={icon} {alt} />
	</div>
{:else}
	{@const Icon = icon}
	<Icon {size} {color} />
{/if}

<style>
	img {
		width: var(--size);
		max-height: var(--size);
	}
	.square {
		height: var(--size);
		display: flex;
		align-items: center;
	}
</style>
