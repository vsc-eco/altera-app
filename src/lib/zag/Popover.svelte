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
		trigger: (attributes: HTMLButtonAttributes) => ReturnType<Snippet>;
		children?: Snippet;
		open?: boolean;
	};
	let { title, description, trigger, children, open = $bindable() }: Props = $props();
	const id = getUniqueId();
	const service = $derived(
		useMachine(popover.machine, {
			id,
			positioning: {
				placement: title ? 'top-end' : 'bottom',
				overflowPadding: 5,
				flip: title ? ['bottom-end'] : ['top'],
				strategy: 'fixed'
			}
		})
	);
	const api = $derived(popover.connect(service, normalizeProps));

	$effect(() => {
		if (open !== undefined) open = api.open;
	});
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
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
	}
	.top-flex {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		padding-bottom: 0.5rem;
		margin-bottom: 0.5rem;
		width: 100%;
		justify-content: space-between;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.top-flex :global([data-part='close-trigger']) {
		margin-bottom: 0;
		transform: translate(0.5rem, 0);
	}
	[data-part='content'][data-variant='full'] {
		max-width: calc(100vw - 2rem);
		position: relative;
		background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		padding: 0.5rem;
		padding-top: 0;
		z-index: 2;
		border-radius: 16px;
		box-shadow: var(--dash-card-shadow);
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	[data-part='content'][data-variant='simple'] {
		max-width: calc(20rem);
		position: relative;
		background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		padding: 0.5rem;
		z-index: 2;
		border-radius: 16px;
		line-height: 1.2;
		box-shadow: var(--dash-card-shadow);
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		font-size: 0.8rem;
	}
	[data-part='arrow'] {
		--arrow-background: rgba(255, 255, 255, 0.1);
		--arrow-size: 1rem;
	}
</style>
