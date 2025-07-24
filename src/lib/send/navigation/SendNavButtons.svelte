<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';

	type navButton = {
		label: string;
		disabled?: boolean;
		action: () => void;
	};
	let {
		buttons
	}: {
		buttons: {
			back: navButton;
			fwd: navButton;
		};
	} = $props();
</script>

<div class="bar">
	<div class="button-wrapper">
		<PillButton onclick={buttons.back.action} disabled={buttons.back.disabled} styleType="outline">
			{buttons.back.label}
		</PillButton>
		<PillButton
			onclick={buttons.fwd.action}
			disabled={buttons.fwd.disabled}
			styleType="invert"
			theme="accent"
		>
			{buttons.fwd.label}
		</PillButton>
	</div>
</div>

<style>
	.bar {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100vw;
		background-color: var(--neutral-off-bg);
		border-top: 1px solid var(--neutral-bg-accent);
		display: flex;
		justify-content: center;
	}
	.button-wrapper {
		display: flex;
		flex-grow: 1;
		justify-content: space-between;
		padding: 1rem 0;
		align-items: center;
		max-width: 42rem;
	}
</style>
