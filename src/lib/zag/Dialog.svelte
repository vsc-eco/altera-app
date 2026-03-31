<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import * as dialog from '@zag-js/dialog';
	import { portal, normalizeProps, useMachine } from '@zag-js/svelte';
	import { ArrowLeft, X } from '@lucide/svelte';
	import { type Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	import Card from '$lib/cards/Card.svelte';
	type Props = {
		content: Snippet;
		title?: Snippet;
		children?: Snippet;
		description?: Snippet;
		toggle?: (open?: boolean) => void;
		back?: () => void;
		defaultOpen?: boolean;
		open?: boolean;
	};
	let {
		content,
		title,
		children,
		description,
		toggle = $bindable(),
		back,
		defaultOpen,
		open = $bindable()
	}: Props = $props();
	let service = $derived(
		useMachine(dialog.machine, {
			id: getUniqueId(),
			defaultOpen
		})
	);
	const api = $derived(dialog.connect(service, normalizeProps));
	toggle = (open: boolean = false) => {
		api.setOpen(open);
	};
	$effect(() => {
		open = api.open;
	});
</script>

{#if children}
	<PillButton
		{...api.getTriggerProps()}
		onclick={api.getTriggerProps().onclick!}
		styleType="outline"
	>
		{@render children()}
	</PillButton>
{/if}
{#if api.open}
	<div use:portal {...api.getBackdropProps()}></div>
	<div use:portal {...api.getPositionerProps()}>
		<div {...api.getContentProps()}>
			<Card defaultBg>
				<div class="title-and-close" class:no-title={!title && !back}>
					{#if back}
						<PillButton onclick={back} styleType="icon-subtle">
							<ArrowLeft size="32" />
						</PillButton>
					{/if}
					{#if title}
						<h2 {...api.getTitleProps()}>{@render title()}</h2>
					{/if}
					<PillButton
						{...api.getCloseTriggerProps()}
						onclick={api.getTriggerProps().onclick!}
						styleType="icon-subtle"
					>
						<X size="32" />
					</PillButton>
				</div>

				{#if description}
					<div {...api.getDescriptionProps()}>
						{@render description()}
					</div>
				{/if}
				{@render content()}
			</Card>
		</div>
	</div>
{/if}

<style lang="scss">
	[data-part='backdrop'] {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		position: fixed;
		top: 0;
		left: 0;
		z-index: 49;
		width: 100%;
		height: 100%;
	}

	[data-part='content'] {
		border: none;
		z-index: 2;
		outline: none;
		max-height: 90dvh;
		position: relative;
		display: flex;
		overflow: visible;
	}

	[data-part='positioner'] {
		border-radius: 27px;
		position: fixed;
		padding: 0.5rem;
		box-sizing: border-box;
		max-width: calc(100% - 0.5rem);
		width: max-content;
		left: 50%;
		top: 50%;
		z-index: 55;
		max-height: 90dvh;
		transform: translate(-50%, -50%);
		overflow: visible;
	}

	[data-part='content'] > :global(div) {
		border-radius: 27px;
		padding: 1.25rem;
		color: var(--dash-text-primary);
	}
	[data-part='content'] :global(h1),
	[data-part='content'] :global(h2),
	[data-part='content'] :global(h3),
	[data-part='content'] :global(h4),
	[data-part='content'] :global(h5),
	[data-part='content'] :global(h6),
	[data-part='content'] :global(label),
	[data-part='content'] :global(span),
	[data-part='content'] :global(p) {
		color: var(--dash-text-primary);
	}
	[data-part='content'] :global(.sm-caption),
	[data-part='content'] :global(.label-like) {
		color: var(--dash-text-secondary);
	}
	[data-part='content'] :global(hr) {
		border-color: var(--dash-divider);
	}
	[data-part='content'] :global(input),
	[data-part='content'] :global(textarea) {
		background: rgba(0, 0, 0, 0.25);
		border-color: rgba(255, 255, 255, 0.08);
		color: var(--dash-text-primary);
	}
	[data-part='content'] :global(fieldset) {
		background: rgba(0, 0, 0, 0.15);
		border-color: rgba(255, 255, 255, 0.08);
		min-width: 0;
		overflow: visible;
	}

	[data-part='title'] {
		font-size: var(--text-3xl);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		color: var(--dash-text-primary);
		margin: 0;
		margin-top: auto;
		padding-right: 2.5rem;
		flex: 1;
		min-width: 0;
	}

	[data-part='positioner'] :global([data-part='close-trigger']) {
		margin-top: 0;
		margin-left: auto;
		margin-right: 0;
		display: flex;
		overflow: hidden;
		z-index: 10;
	}

	.title-and-close {
		display: flex;
		position: relative;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.title-and-close.no-title {
		height: 0;
	}

	@media screen and (max-width: 36rem) {
		[data-part='positioner'] {
			width: 100vw;
			height: 100dvh;
			max-width: none;
			max-height: 100dvh;
		}
		[data-part='content'] {
			max-height: calc(100dvh - 1rem);
			height: 100%;
		}
	}
</style>
