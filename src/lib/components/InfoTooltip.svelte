<script lang="ts">
	import type { Snippet } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { CircleAlert, Info } from '@lucide/svelte';
	import Popover from '$lib/zag/Popover.svelte';
	type Props = {
		children: Snippet;
		warning?: boolean;
	};
	const { children, warning = false }: Props = $props();
</script>

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon-subtle">
		{#if warning}
			<CircleAlert color="var(--secondary-fg-mid)" />
		{:else}
			<Info />
		{/if}
	</PillButton>
{/snippet}
<span class="info-button">
	<Popover {trigger}>
		{@render children()}
	</Popover></span
>
