<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	let { onclick }: { onclick: MouseEventHandler<HTMLButtonElement> } = $props();
</script>

<PillButton {onclick} styleType="text-subtle">
	<span>Edit</span>
</PillButton>

<style>
	span {
		font-size: var(--text-sm);
		color: var(--primary-fg-mid);
	}
</style>
