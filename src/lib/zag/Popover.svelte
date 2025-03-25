<script lang="ts">
	import * as popover from '@zag-js/popover';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { X } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	type Props = {
		title: string;
		description?: string;
		trigger: Snippet<[HTMLButtonAttributes]>;
		children?: Snippet;
	};
	const { title, description, trigger, children }: Props = $props();
	const id = getUniqueId();
	const service = useMachine(popover.machine, {
		id,
		positioning: {
			placement: 'top-end'
		}
	});
	const api = $derived(popover.connect(service, normalizeProps));
</script>

<!-- <button {...api.getTriggerProps()}>Click me</button> -->
{@render trigger(api.getTriggerProps())}
<div use:portal={{ disabled: !api.portalled }} {...api.getPositionerProps()}>
	<div {...api.getContentProps()}>
		<div class="top-flex">
			<div {...api.getTitleProps()}>{title}</div>
			<PillButton
				styleType="icon-outline"
				{...api.getCloseTriggerProps()}
				onclick={api.getCloseTriggerProps().onclick!}><X aria-label="Close"></X></PillButton
			>
		</div>
		{#if description}
			<div {...api.getDescriptionProps()}>{description}</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	[data-part='title'] {
		font-size: var(--text-1xl);
		color: var(--primary-fg-mid);
		font-weight: 500;
	}
	.top-flex {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		padding-bottom: 0.5rem;
		margin-bottom: 0.5rem;
		width: 100%;
		justify-content: space-between;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	.top-flex :global([data-part='close-trigger']) {
		margin-bottom: 0;
	}
	[data-part='content'] {
		max-width: calc(100vw - 2rem);
		position: relative;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent);
		padding: 0.5rem;
		padding-top: 0;
		border-radius: 0.5rem;
	}
</style>
