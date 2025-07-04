<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';

	type navButton = {
		label: string;
		disabled?: boolean;
		action: () => void;
	};
	let {
		buttons,
		small = false
	}: {
		buttons: {
			back: navButton;
			fwd: navButton;
		};
		small?: boolean;
	} = $props();
</script>

<div class={["bar", {full: !small}]} id="send-footer">
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

<style lang="scss">
	.bar.full {
		width: 100vw;
		background-color: var(--neutral-off-bg);
		border-top: 1px solid var(--neutral-bg-accent);
		display: flex;
		justify-content: center;
		translate: -0.5rem 0;
		.button-wrapper {
			padding: 1rem 0;
			max-width: 42rem;
		}
	}
	.button-wrapper {
		display: flex;
		flex-grow: 1;
		justify-content: space-between;
		margin: 0 1rem;
		align-items: center;
		padding-top: 1rem;
	}
</style>
