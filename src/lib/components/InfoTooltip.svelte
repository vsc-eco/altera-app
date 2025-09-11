<script lang="ts">
	import type { Snippet } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { Info } from '@lucide/svelte';
	import Popover from '$lib/zag/Popover.svelte';
	type Props = {
		children: Snippet;
	};
	const { children }: Props = $props();
</script>

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon-subtle">
		<Info />
	</PillButton>
{/snippet}
<span class="info-button">
	<Popover {trigger}>
		{@render children()}
	</Popover></span
>
