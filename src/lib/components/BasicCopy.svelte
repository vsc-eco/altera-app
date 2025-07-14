<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { ClipboardCheck, ClipboardCopy } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { value, children }: { value: string, children?: Snippet } = $props();

	let copied = $state(false);
	let timeoutId: NodeJS.Timeout;
	function handleClick() {
		copied = true;
		navigator.clipboard.writeText(value);
		copied = true;
		timeoutId = setTimeout(() => {
			copied = false; // Revert to the original value
		}, 2000);
	}
</script>

<div>
    {#if children}
        {@render children()}
    {:else}
	    {value}
    {/if}
	<PillButton onclick={handleClick} styleType="icon-subtle" disabled={copied}>
		{#if copied}
			<ClipboardCheck class="clipboard-icon" />
		{:else}
			<ClipboardCopy class="clipboard-icon" />
		{/if}
	</PillButton>
</div>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	:global(.clipboard-icon) {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
