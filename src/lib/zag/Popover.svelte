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
		/** Receives a `close` callback so content can dismiss the popover —
		 *  e.g. a link inside it that navigates away. Snippets that don't
		 *  declare the parameter simply ignore it. */
		children?: Snippet<[() => void]>;
		open?: boolean;
		/** Also reveal on mouse hover, tooltip-style, on top of the normal
		 *  click-to-open. The pointer type is checked, so touch and pen keep
		 *  tap-to-open only: a touch "hover" would otherwise open the popover
		 *  and the click that follows would immediately toggle it shut. */
		hoverable?: boolean;
	};
	let {
		title,
		description,
		trigger,
		children,
		open = $bindable(),
		hoverable = false
	}: Props = $props();
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

	// ── Hover mode (opt-in via `hoverable`) ─────────────────────────────────
	/** Closing is deferred so the pointer can cross the gap between trigger
	 *  and content without the popover vanishing mid-travel. */
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	/** Whether the current open state came from hovering. A click while the
	 *  pointer is already over the trigger would otherwise toggle the popover
	 *  shut the instant you tried to click into it. */
	let openedByHover = false;

	function cancelClose() {
		clearTimeout(closeTimer);
		closeTimer = undefined;
	}
	function hoverOpen(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		cancelClose();
		if (!api.open) openedByHover = true;
		api.setOpen(true);
	}
	function hoverClose(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		cancelClose();
		closeTimer = setTimeout(() => {
			closeTimer = undefined;
			openedByHover = false;
			api.setOpen(false);
		}, 150);
	}
	$effect(() => () => cancelClose());

	const triggerProps: HTMLButtonAttributes = $derived.by(() => {
		const props = api.getTriggerProps() as HTMLButtonAttributes;
		if (!hoverable) return props;
		const baseClick = props.onclick;
		return {
			...props,
			onpointerenter: hoverOpen,
			onpointerleave: hoverClose,
			onclick: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
				// Already showing because of the hover — keep it up rather
				// than letting the toggle close it.
				if (openedByHover && api.open) return;
				openedByHover = false;
				baseClick?.(e);
			}
		};
	});
</script>

<!-- <button {...api.getTriggerProps()}>Click me</button> -->
{@render trigger(triggerProps)}
<div use:portal={{ disabled: !api.portalled }} {...api.getPositionerProps()}>
	<div
		{...api.getContentProps()}
		onpointerenter={hoverable ? cancelClose : undefined}
		onpointerleave={hoverable ? hoverClose : undefined}
		data-variant={title ? 'full' : 'simple'}
	>
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
			{@render children(() => api.setOpen(false))}
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
		align-items: center;
		padding-bottom: 0.6rem;
		margin-bottom: 0.6rem;
		width: 100%;
		justify-content: space-between;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.top-flex :global([data-part='close-trigger']) {
		margin-bottom: 0;
		flex-shrink: 0;
	}
	[data-part='content'][data-variant='full'] {
		max-width: calc(100vw - 2rem);
		position: relative;
		background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
		backdrop-filter: blur(10px);
		border: 1px solid var(--dash-card-border);
		padding: 0.85rem 1rem 1rem;
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
