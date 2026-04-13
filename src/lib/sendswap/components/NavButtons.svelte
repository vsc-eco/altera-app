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

<div class={fixed ? 'bar-fixed' : 'bar'} id="send-footer" bind:this={barElement}>
	<div class="button-wrapper">
		{#if buttons.back}
			<PillButton
				onclick={buttons.back.action}
				disabled={buttons.back.disabled}
				styleType="stage outline"
			>
				{buttons.back.label}
			</PillButton>
		{/if}
		<PillButton
			onclick={buttons.fwd.action}
			disabled={buttons.fwd.disabled}
			styleType="stage invert"
			theme="accent"
		>
			{buttons.fwd.label}
		</PillButton>
	</div>
</div>

<style lang="scss">
	.bar {
		margin-top: 1rem;
		@media screen and (max-width: 450px) {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding-bottom: 1rem;
			--background-color: oklch(from var(--dash-bg) l c h / 0.9);
			background-color: var(--background-color);
			box-shadow: 0 -5px 5px -5px var(--background-color);
			border: 1px solid var(--dash-card-border);
			border-top: none;
			border-radius: 0 0 16px 16px;
		}
	}
	.bar-fixed {
		display: flex;
		justify-content: center;
		padding: 10px 0 1rem;
		position: relative;
		top: -1rem;
	}
	.button-wrapper {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin: 0 auto;
		align-items: center;
		width: 480px;
		max-width: calc(100% - 2rem);
		pointer-events: auto;
		:global(button) {
			margin: 0;
			flex-grow: 1;
		}
	}
</style>
