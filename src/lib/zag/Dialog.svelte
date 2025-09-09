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
	let service = useMachine(dialog.machine, {
		id: getUniqueId(),
		defaultOpen
	});
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
		// TODO: change to shade of official color
		background-color: oklch(from var(--primary-mid) l c h / 0.1);
		backdrop-filter: blur(4px);
		position: fixed;
		top: 0;
		left: 0;
		z-index: 10;
		width: 100%;
		height: 100%;
		/* styles for the backdrop element */
	}

	[data-part='content'] {
		border: none;
		z-index: 2;
		outline: none;
		max-height: 90vh;
		position: relative;
		display: flex;
		@media screen and (max-width: 450px) {
			max-height: calc(100vh - 1rem);
		}
	}

	[data-part='positioner'] {
		border-radius: 0.75rem;
		position: fixed;
		padding: 0.5rem;
		box-sizing: border-box;
		max-width: calc(100% - 0.5rem);
		width: max-content;
		left: 50%;
		top: 50%;
		z-index: 10;
		max-height: 90vh;
		transform: translate(-50%, -50%);

		@media screen and (max-width: 450px) {
			width: 100vw;
			height: 100vh;
			max-width: none;
			max-height: 100vh;
		}
	}

	[data-part='content'] > :global(div) {
		border-radius: 0.75rem;
		padding: 1rem;
	}

	[data-part='title'] {
		font-size: var(--text-3xl);
		margin: 0;
		margin-top: auto;
		/* styles for the title element */
	}

	[data-part='positioner'] :global([data-part='close-trigger']) {
		margin-top: 0;
		margin-left: auto;
		margin-right: 0;
		display: flex;
		overflow: hidden;
		z-index: 10;
		/* styles for the close trigger element */
	}

	.title-and-close {
		display: flex;
		position: relative;
	}

	.title-and-close.no-title {
		height: 0;
	}
</style>
