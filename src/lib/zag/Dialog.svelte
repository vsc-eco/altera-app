<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import * as dialog from '@zag-js/dialog';
	import { portal, normalizeProps, useMachine } from '@zag-js/svelte';
	import { X } from '@lucide/svelte';
	import { type Snippet } from 'svelte';
	import { getUniqueId } from './idgen';
	import Card from '$lib/cards/Card.svelte';
	type Props = {
		content: Snippet;
		title?: Snippet;
		children?: Snippet;
		description?: Snippet;
		toggle?: (open?: boolean) => void;
		defaultOpen?: boolean;
		open?: boolean;
	};
	let {
		content,
		title,
		children,
		description,
		toggle: toggle = $bindable(),
		defaultOpen,
		open = $bindable()
	}: Props = $props();
	let service = useMachine(dialog.machine, { id: getUniqueId(), defaultOpen });
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
			<Card>
				<div class="title-and-close" class:no-title={!title}>
					{#if title}
						<h2 {...api.getTitleProps()}>{@render title()}</h2>
					{/if}
					<PillButton
						{...api.getCloseTriggerProps()}
						onclick={api.getTriggerProps().onclick!}
						styleType="icon-outline"
					>
						<X/>
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
		background-color: rgb(0, 0, 0, 0.2);
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
	}

	[data-part='positioner'] {
		border-radius: 0.5rem;
		position: fixed;
		padding: 0.5rem;
		width: max(80vw, 25rem);
		box-sizing: border-box;
		max-width: calc(100% - 0.5rem);
		width: max-content;
		left: 50%;
		top: 50%;
		z-index: 10;
		max-height: calc(100svh - var(--top-offset, 0) * 8);
		transform: translate(-50%, -50%);

		/* styles for the positioner element */
	}

	[data-part='content'] > :global(div) {
		border-radius: 0.5rem;
		padding: 1rem;

		/* styles for the positioner element */
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
		/* styles for the close trigger element */
	}

	.title-and-close {
		display: flex;
	}

	.title-and-close.no-title {
		height: 0.5em;
	}
</style>
