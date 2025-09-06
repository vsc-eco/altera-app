<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { X } from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';

	type Props = {
		content: (() => ReturnType<Snippet>) | undefined;
		title?: Snippet;
		children?: Snippet;
		description?: Snippet;
		toggle: () => void;
		defaultOpen?: boolean;
		open?: boolean;
		position?: 'left' | 'right' | 'top' | 'bottom';
		width?: string;
		height?: string;
	};

	let {
		content,
		title,
		children,
		description,
		toggle,
		defaultOpen = false,
		open = $bindable(defaultOpen),
		position = 'right',
		width = '400px',
		height = 'auto'
	}: Props = $props();

	let remValue = $state(0);
	onMount(() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	});

	let scrollY = $state(0);
	let windowWidth = $state(0);
	const visibleHeaderHeight = $derived(Math.max(0, 50 - scrollY));
	// width of popup * 2 + 64rem (max content width) + width of left side panel
	// if windowWidth is greater than this the popup fits to the right of header
	const mustAvoidHeader = $derived(windowWidth < 400 * 2 + 64 * remValue + 205);
	// console.log("mustAvoidHeader")

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			toggle();
		}
	}

	// Get transition parameters based on position
	function getTransition() {
		switch (position) {
			case 'left':
				return { x: -300, duration: 300 };
			case 'right':
				return { x: 300, duration: 300 };
			case 'top':
				return { y: -300, duration: 300 };
			case 'bottom':
				return { y: 300, duration: 300 };
			default:
				return { x: 300, duration: 300 };
		}
	}

	// Get positioning styles
	function getPositionStyles() {
		const baseStyles = {
			position: 'fixed',
			zIndex: 12,
			width: position === 'left' || position === 'right' ? width : '100%',
			height: position === 'top' || position === 'bottom' ? height : '100%',
			maxHeight: '100vh',
			overflow: 'auto',
			margin: '0.5rem'
		};

		switch (position) {
			case 'left':
				return {
					...baseStyles,
					left: '0',
					top: mustAvoidHeader ? `${visibleHeaderHeight}px` : '0',
					height: mustAvoidHeader ? `calc(100% - ${visibleHeaderHeight}px)` : '100%'
				};
			case 'right':
				return {
					...baseStyles,
					right: '0',
					top: mustAvoidHeader ? `${visibleHeaderHeight}px` : '0',
					height: mustAvoidHeader ? `calc(100% - ${visibleHeaderHeight}px)` : '100%'
				};
			case 'top':
				return { ...baseStyles, top: '0', left: '0', width: '100%' };
			case 'bottom':
				return { ...baseStyles, bottom: '0', left: '0', width: '100%' };
			default:
				return { ...baseStyles, right: '0', top: '0', height: '100%' };
		}
	}
</script>

<svelte:window
	on:keydown={handleKeydown}
	bind:scrollY
	bind:innerWidth={windowWidth}
	on:resize={() => {
		const rootStyle = getComputedStyle(document.documentElement);
		remValue = parseFloat(rootStyle.fontSize);
	}}
/>

{#if children}
	<PillButton onclick={() => (open = true)} styleType="outline">
		{@render children()}
	</PillButton>
{/if}

{#if open}
	<div
		class="popup-container"
		style={Object.entries(getPositionStyles())
			.map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
			.join('; ')}
		transition:fly={getTransition()}
		role="dialog"
		aria-modal="false"
		tabindex="-1"
	>
		<div class="background">
			<div class="close-button">
				<PillButton onclick={toggle} styleType="icon-subtle">
					<X size="32" />
				</PillButton>
			</div>
			<div class="popup-content">
				{#if title}
					<h2 class="popup-title">{@render title()}</h2>
				{/if}

				{#if description}
					<div class="popup-description">
						{@render description()}
					</div>
				{/if}

				<div class="popup-body">
					{#if content}
						{@render content()}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.popup-container {
		/* Allows clicks to pass through to background */
		pointer-events: auto;

		/* Smooth scrolling */
		scroll-behavior: smooth;

		/* Ensure proper stacking */
		isolation: isolate;
	}

	.background {
		background-color: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
		padding: 0.5rem;
		overflow: auto;
		position: relative;
		height: calc(100% - 2.1rem);
		display: flex;
	}

	.close-button {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		height: fit-content;
	}

	.popup-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		flex: 1;
	}

	.popup-title {
		font-size: var(--text-3xl);
		margin: 0;
		font-weight: 600;
	}

	.popup-description {
		color: var(--text-muted, #666);
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.popup-body {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}

	/* Responsive adjustments */
	@media screen and (max-width: 630px) {
		.popup-container {
			width: 100% !important;
			max-width: 100% !important;
		}
	}
</style>
