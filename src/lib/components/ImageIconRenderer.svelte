<script lang="ts">
	import type { Dot } from '@lucide/svelte';
	import { type Component } from 'svelte';

	type Props = {
		icon: ImgIconOption;
		alt?: string;
		size?: number;
	};
	let { icon, alt, size = 24 }: Props = $props();

	export type ImgIconOption = string | typeof Dot;
</script>

{#if typeof icon === 'string'}
	<img src={icon} {alt} width={size} height={size} />
{:else}
	{@const Icon = icon}
	<Icon {size} />
{/if}
