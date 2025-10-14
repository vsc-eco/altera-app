<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';

	export type NavButton = {
		label: string;
		disabled?: boolean;
		action: () => void;
	};
	let {
		buttons,
		fixed = true
	}: {
		buttons: {
			back?: NavButton;
			fwd: NavButton;
		};
		fixed?: boolean;
	} = $props();

	let barElement = $state<HTMLDivElement>();
	function calculateOffset() {
		if (!barElement) return;
		const navElement = document.getElementById('sidebar-nav');
		if (navElement) {
			barElement.style.setProperty('--left-offset', `${navElement.offsetWidth}px`);
		}
	}
	$effect(() => {
		barElement;
		calculateOffset();
	});
</script>

<svelte:window on:resize={calculateOffset} on:visibilitychange={calculateOffset} />

<div class={['bar', { fixed }]} id="send-footer" bind:this={barElement}>
	<div class="button-wrapper">
		{#if buttons.back}
			<PillButton
				onclick={buttons.back.action}
				disabled={buttons.back.disabled}
				styleType="outline"
			>
				{buttons.back.label}
			</PillButton>
		{/if}
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
	.bar:not(.fixed) {
		margin-top: 1rem;
		@media screen and (max-width: 450px) {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding-bottom: 1rem;
			--background-color: oklch(from var(--neutral-bg) l c h / 0.9);
			background-color: var(--background-color);
			box-shadow: 0 -5px 5px -5px var(--background-color);
			border: 1px solid var(--neutral-bg-accent);
			border-top: none;
			border-radius: 0 0 0.75rem 0.75rem;
		}
	}
	.bar.fixed {
		position: fixed;
		bottom: 0;
		right: 0;
		left: 0;
		display: flex;
		justify-content: center;
		padding-bottom: 1rem;
		--background-color: oklch(from var(--neutral-bg) l c h / 0.9);
		background-color: var(--background-color);
		box-shadow: 0 -5px 5px var(--background-color);
		@media screen and (min-width: 620px) {
			left: var(--left-offset, 0);
		}
	}
	.button-wrapper {
		display: flex;
		flex-grow: 1;
		justify-content: center;
		gap: 1.5rem;
		margin: 0 1rem;
		align-items: center;
		max-width: 42rem;
		// background-color: var(--neutral-bg);
		:global(button) {
			margin: 0;
			flex-grow: 1;
			max-width: 22rem;
			box-shadow: 0 0 4px oklch(from var(--dark-purple) l c h / 0.1);
		}
		:global(button.outline) {
			background-color: var(--neutral-bg);
		}
	}
</style>
