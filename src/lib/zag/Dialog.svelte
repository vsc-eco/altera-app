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
		title: Snippet;
		children: Snippet;
		description?: Snippet;
		close?: () => void;
	};
	let { content, title, children, description, close = $bindable() }: Props = $props();
	let service = useMachine(dialog.machine, { id: getUniqueId() });
	const api = $derived(dialog.connect(service, normalizeProps));
	close = () => {
		api.setOpen(false);
	};
</script>

<PillButton {...api.getTriggerProps()} onclick={api.getTriggerProps().onclick!} styleType="default">
	{@render children()}
</PillButton>
{#if api.open}
	<div use:portal {...api.getBackdropProps()}></div>
	<div use:portal {...api.getPositionerProps()}>
		<Card>
			<div {...api.getContentProps()}>
				<PillButton
					{...api.getCloseTriggerProps()}
					onclick={api.getTriggerProps().onclick!}
					styleType="icon"
				>
					<X></X>
				</PillButton>
				<h2 {...api.getTitleProps()}>{@render title()}</h2>
				{#if description}
					<div {...api.getDescriptionProps()}>
						{@render description()}
					</div>
				{/if}
				{@render content()}
			</div>
		</Card>
	</div>
{/if}

<style>
	[data-part='backdrop'] {
		background-color: rgb(0, 0, 0, 0.2);
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		/* styles for the backdrop element */
	}

	[data-part='positioner'] {
		border-radius: 0.5rem;
		position: absolute;
		padding: 0.5rem;
		top: 25%;
		max-width: 75vw;
		width: max-content;
		overflow: auto;
		left: 50%;
		z-index: 10;
		transform: translateX(-50%) translateY(-50%);

		/* styles for the positioner element */
	}

	[data-part='title'] {
		font-size: var(--text-2xl);
		margin: 0;
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
</style>
