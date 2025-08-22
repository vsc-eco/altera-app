<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { ClipboardCheck, ClipboardCopy } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		value,
		children,
		show = true,
		clickAnywhere = false
	}: { value: string; children?: Snippet; show?: boolean; clickAnywhere?: boolean } = $props();

	let copied = $state(false);
	let timeoutId: NodeJS.Timeout;
	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		copied = true;
		navigator.clipboard.writeText(value);
		copied = true;
		timeoutId = setTimeout(() => {
			copied = false; // Revert to the original value
		}, 2000);
	}
</script>

<span>
	<span
		class={['content', { clickable: clickAnywhere }]}
		role="button"
		onclick={clickAnywhere ? handleClick : undefined}
		onkeydown={() => {}}
		tabindex="-1"
	>
		{#if children}
			{@render children()}
		{:else}
			{value}
		{/if}
	</span>

	<PillButton onclick={handleClick} styleType="icon-subtle" disabled={copied} hide={!show}>
		{#if copied}
			<ClipboardCheck class="clipboard-icon" />
		{:else}
			<ClipboardCopy class="clipboard-icon" />
		{/if}
	</PillButton>
</span>

<style>
	span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.clickable {
		cursor: pointer;
	}
	:global(.clipboard-icon) {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
