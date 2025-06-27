<script lang="ts">
	import * as popover from '@zag-js/popover';
	import { portal, useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { X } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	type Props = {
		title?: string;
		description?: string;
		trigger: Snippet<[HTMLButtonAttributes]>;
		children?: Snippet;
	};
	const { title, description, trigger, children }: Props = $props();
	const id = getUniqueId();
	const service = useMachine(popover.machine, {
		id,
		positioning: {
			placement: title ? 'top-end' : 'bottom',
			overflowPadding: 5,
			flip: ['top'],
			strategy: 'fixed'
		}
	});
	const api = $derived(popover.connect(service, normalizeProps));
</script>

<!-- <button {...api.getTriggerProps()}>Click me</button> -->
{@render trigger(api.getTriggerProps())}
<div use:portal={{ disabled: !api.portalled }} {...api.getPositionerProps()}>
	<div {...api.getContentProps()} data-variant={title ? 'full' : 'simple'}>
		{#if title}
			<div class="top-flex">
				<div {...api.getTitleProps()}>{title}</div>
				<PillButton
					styleType="icon-subtle"
					{...api.getCloseTriggerProps()}
					onclick={api.getCloseTriggerProps().onclick!}><X aria-label="Close"></X></PillButton
				>
			</div>
		{:else}
			<div {...api.getArrowProps()}>
				<div {...api.getArrowTipProps()}></div>
			</div>
		{/if}
		{#if description}
			<div {...api.getDescriptionProps()}>{description}</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style lang="scss">
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
		transform: translate(0.5rem, 0);
	}
	[data-part='content'][data-variant='full'] {
		max-width: calc(100vw - 2rem);
		position: relative;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent);
		padding: 0.5rem;
		padding-top: 0;
		z-index: 2;
		border-radius: 0.5rem;
	}
	[data-part='content'][data-variant='simple'] {
		max-width: calc(100vw / 8);
		position: relative;
		background-color: var(--neutral-bg);
		// filter: drop-shadow(1px 1px var(--neutral-bg-accent)) drop-shadow(-1px -1px var(--neutral-bg-accent));
		border: 1px solid var(--neutral-bg-accent);
		padding: 0.5rem;
		z-index: 2;
		border-radius: 0.5rem;
		line-height: 1.2;
	}
	[data-part='arrow'] {
		--arrow-background: var(--neutral-bg);
		--arrow-size: 1rem;
		// had to remove this because it messes up when it gets moved to top
		// and the selector for top placement only works for content bit
		// filter: drop-shadow(-0.25px -0.5px var(--neutral-bg-accent))
		// 	drop-shadow(0.5px -0.5px var(--neutral-bg-accent));
	}
</style>
