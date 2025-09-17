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
	<img src={icon} {alt} width={size} />
{:else}
	{@const Icon = icon}
	<Icon {size} {color} />
{/if}
