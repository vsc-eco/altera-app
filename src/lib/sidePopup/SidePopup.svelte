<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { X } from '@lucide/svelte';
	import { type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import Card from '$lib/cards/Card.svelte';

	type Props = {
		content: Snippet;
		title?: Snippet;
		children?: Snippet;
		description?: Snippet;
		toggle?: (open?: boolean) => void;
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
		toggle = $bindable(),
		defaultOpen = false,
		open = $bindable(defaultOpen),
		position = 'right',
		width = '400px',
		height = 'auto'
	}: Props = $props();

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
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
			zIndex: 1000,
			width: position === 'left' || position === 'right' ? width : '100%',
			height: position === 'top' || position === 'bottom' ? height : '100%',
			maxHeight: '100vh',
			overflow: 'auto'
		};

		switch (position) {
			case 'left':
				return { ...baseStyles, left: '0', top: '0', height: '100%' };
			case 'right':
				return { ...baseStyles, right: '0', top: '0', height: '100%' };
			case 'top':
				return { ...baseStyles, top: '0', left: '0', width: '100%' };
			case 'bottom':
				return { ...baseStyles, bottom: '0', left: '0', width: '100%' };
			default:
				return { ...baseStyles, right: '0', top: '0', height: '100%' };
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

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
		<Card>
			<div class="popup-content">
				<div class="title-and-close" class:no-title={!title}>
					{#if title}
						<h2 class="popup-title">{@render title()}</h2>
					{/if}
					<PillButton onclick={() => (open = false)} styleType="icon-outline">
						<X />
					</PillButton>
				</div>

				{#if description}
					<div class="popup-description">
						{@render description()}
					</div>
				{/if}

				<div class="popup-body">
					{@render content()}
				</div>
			</div>
		</Card>
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

	.popup-content {
		padding: 1rem;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.popup-title {
		font-size: var(--text-3xl);
		margin: 0;
		font-weight: 600;
	}

	.title-and-close {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-shrink: 0;
	}

	.title-and-close.no-title {
		justify-content: flex-end;
		min-height: 2rem;
	}

	.popup-description {
		color: var(--text-muted, #666);
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.popup-body {
		flex: 1;
		overflow: auto;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.popup-container {
			width: 100% !important;
			max-width: 100% !important;
		}
	}
</style>