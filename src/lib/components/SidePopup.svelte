<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { X } from '@lucide/svelte';
	import { untrack, type Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { portal } from '@zag-js/svelte';

	type Props = {
		content: (() => ReturnType<Snippet>) | undefined;
		title?: Snippet;
		children?: Snippet;
		description?: Snippet;
		toggle: () => void;
		defaultOpen?: boolean;
		open?: boolean;
	};

	let {
		content,
		title,
		children,
		description,
		toggle,
		defaultOpen = false,
		open = $bindable()
	}: Props = $props();

	open = !!untrack(() => defaultOpen);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) toggle();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if children}
	<PillButton onclick={() => (open = true)} styleType="outline">
		{@render children()}
	</PillButton>
{/if}

{#if open}
	<!-- Teleported to document.body so it escapes any overflow/stacking constraints -->
	<div use:portal class="popup-backdrop" transition:fade={{ duration: 200 }} onclick={toggle} role="presentation"></div>

	<div use:portal class="popup-container" transition:fly={{ y: 24, duration: 250 }} role="dialog" aria-modal="true" tabindex="-1">
		<Card opaque style="flex: 1; min-height: 0; overflow: hidden; box-sizing: border-box;">
			<div class="popup-content">
				<div class="popup-header">
					{#if title}
						<h2 class="popup-title">{@render title()}</h2>
					{/if}
					<PillButton onclick={toggle} styleType="icon-subtle">
						<X size="32" />
					</PillButton>
				</div>

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
		</Card>
	</div>
{/if}

<style lang="scss">
	.popup-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 49;
		cursor: pointer;
	}

	.popup-container {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 55;
		width: 480px;
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 4rem);
		display: flex;
		flex-direction: column;
	}

	/*
	 * Card is display:grid — its single child (popup-content) stretches to fill it.
	 * popup-content uses flex-column so the header is pinned and the body scrolls.
	 */
	.popup-content {
		display: flex;
		flex-direction: column;
		/* fills the Card grid cell */
		align-self: stretch;
		min-height: 0;
		overflow: hidden;
		gap: 1rem;
	}

	.popup-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.popup-title {
		flex: 1;
		font-size: var(--text-3xl);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		color: var(--dash-text-primary);
		margin: 0;
	}

	.popup-description {
		color: var(--dash-text-secondary);
		font-size: 0.85rem;
		font-family: 'Nunito Sans', sans-serif;
		flex-shrink: 0;
	}

	.popup-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
