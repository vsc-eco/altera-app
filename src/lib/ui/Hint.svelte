<script lang="ts">
	/**
	 * The (?) next to a label: a short explanation on demand, instead of a
	 * paragraph on the page.
	 *
	 * Hover or focus shows it; a tap or click pins it open (that is how it
	 * works on a phone, where there is no hover); Escape, a second tap or a
	 * tap anywhere else closes it.
	 *
	 * The bubble is a `popover`, so it sits in the browser's top layer: no
	 * scrolling table, `overflow: hidden` card or stacking context can clip
	 * it or paint over it. It stays inside `.alt-root` in the DOM, so it keeps
	 * the redesign palette — the thing a portalled tooltip loses.
	 *
	 * Use `text` for a sentence or two; pass children for anything richer.
	 */
	import type { Snippet } from 'svelte';
	import { getUniqueId } from '$lib/zag/idgen';

	let {
		text,
		children,
		label = 'More info',
		size = 16
	}: {
		/** The explanation. Keep it to one or two sentences. */
		text?: string;
		/** Richer content instead of `text`. */
		children?: Snippet;
		/** Accessible name of the (?) button. */
		label?: string;
		/** Diameter of the (?) in px. */
		size?: number;
	} = $props();

	const id = `hint-${getUniqueId()}`;
	let button = $state<HTMLButtonElement>();
	let bubble = $state<HTMLDivElement>();
	let open = $state(false);
	let pinned = $state(false);

	const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

	const GAP = 8;
	const MARGIN = 8;

	function place() {
		if (!button || !bubble) return;
		const r = button.getBoundingClientRect();
		const b = bubble.getBoundingClientRect();
		// Above the (?) when there is room, otherwise below it.
		let top = r.top - b.height - GAP;
		if (top < MARGIN) top = r.bottom + GAP;
		let left = r.left + r.width / 2 - b.width / 2;
		left = Math.max(MARGIN, Math.min(left, window.innerWidth - b.width - MARGIN));
		bubble.style.top = `${Math.round(top)}px`;
		bubble.style.left = `${Math.round(left)}px`;
	}

	function show() {
		if (open || !bubble) return;
		if (supportsPopover) bubble.showPopover();
		open = true;
		place();
	}

	function hide(force = false) {
		if (!open || (pinned && !force)) return;
		if (supportsPopover && bubble?.matches(':popover-open')) bubble.hidePopover();
		open = false;
		pinned = false;
	}

	function toggle() {
		if (pinned) return hide(true);
		pinned = true;
		show();
	}

	$effect(() => {
		if (!open) return;
		const reposition = () => place();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') hide(true);
		};
		const onPointer = (e: PointerEvent) => {
			const t = e.target as Node;
			if (button?.contains(t) || bubble?.contains(t)) return;
			hide(true);
		};
		window.addEventListener('scroll', reposition, true);
		window.addEventListener('resize', reposition);
		document.addEventListener('keydown', onKey);
		document.addEventListener('pointerdown', onPointer);
		return () => {
			window.removeEventListener('scroll', reposition, true);
			window.removeEventListener('resize', reposition);
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointer);
		};
	});
</script>

<button
	bind:this={button}
	type="button"
	class="hint"
	style:--hint-size="{size}px"
	aria-label={label}
	aria-describedby={id}
	aria-expanded={open}
	onmouseenter={show}
	onmouseleave={() => hide()}
	onfocus={show}
	onblur={() => hide(true)}
	onclick={(e) => {
		// A (?) inside a label or a clickable row must not trigger it too.
		e.preventDefault();
		e.stopPropagation();
		toggle();
	}}>?</button
><div
	bind:this={bubble}
	{id}
	role="tooltip"
	class="hint-bubble"
	class:fallback-open={!supportsPopover && open}
	popover={supportsPopover ? 'manual' : undefined}
>
	{#if children}{@render children()}{:else}{text}{/if}
</div>

<style lang="scss">
	.hint {
		all: unset;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: var(--hint-size);
		height: var(--hint-size);
		margin-left: 4px;
		border-radius: 999px;
		border: 1px solid var(--alt-card-border, rgba(255, 255, 255, 0.18));
		background: var(--alt-chip, rgba(255, 255, 255, 0.07));
		color: var(--alt-tx-2, #9ca3af);
		font-size: calc(var(--hint-size) * 0.65);
		font-weight: 800;
		line-height: 1;
		cursor: help;
		vertical-align: middle;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.hint:hover,
	.hint:focus-visible,
	.hint[aria-expanded='true'] {
		background: var(--alt-acc-soft, rgba(111, 106, 248, 0.15));
		color: var(--alt-acc-tx, #a9a5ff);
	}
	.hint:focus-visible {
		outline: 2px solid var(--alt-accent, #6f6af8);
		outline-offset: 2px;
	}

	.hint-bubble {
		/* `popover` brings UA styles that centre it in the viewport; the
		   coordinates come from place() instead. */
		position: fixed;
		inset: auto;
		margin: 0;
		box-sizing: border-box;
		max-width: min(280px, calc(100vw - 16px));
		padding: 9px 11px;
		border-radius: 10px;
		border: 1px solid var(--alt-card-border, rgba(255, 255, 255, 0.12));
		background: var(--alt-modal, #0f1225);
		color: var(--alt-tx, #fff);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		font-size: 12.5px;
		font-weight: 500;
		line-height: 1.45;
		letter-spacing: 0.01em;
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
		z-index: 1000;
	}
	/* Browsers without the popover API: plain fixed positioning. */
	.hint-bubble:not([popover]) {
		display: none;
	}
	.hint-bubble.fallback-open {
		display: block;
	}
</style>
