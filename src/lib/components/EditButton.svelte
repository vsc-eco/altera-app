<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	let { onclick }: { onclick: () => void } = $props();
</script>

<PillButton {onclick} styleType="text-subtle">
	<span>Edit</span>
</PillButton>

<style>
	span {
		font-size: var(--text-sm);
		color: var(--accent-fg-mid);
	}
</style>
