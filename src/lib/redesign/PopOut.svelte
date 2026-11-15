<!--
	"Show this bigger" — a button that lifts one card's contents into a modal
	at full size.

	It is a native <dialog> opened with showModal(), not a portalled overlay,
	for two reasons.

	The top layer sits above every stacking context, so this cannot repeat the
	AltShell z-index bug (`deeacca`), where an overlay that looked perfectly
	normal silently ate every click beneath it. The ladder there is main and
	footer at 1, the outside-click scrim at 4, header at 5 — anything
	portalled out to <body> has to be fitted into that by hand, and the top
	layer removes the question.

	And because the dialog stays where it is in the DOM — inside `.alt-root` —
	it inherits the `--alt-*` tokens, so the enlarged card matches the page it
	came from. A dialog portalled to <body> lands outside `.alt-root` and
	falls back to the old dashboard palette, which is what every zag Dialog in
	the app does today.

	`content` renders only while the dialog is open, so a chart inside it
	fetches nothing until someone asks to see it. It receives the body's
	height in pixels, so the content can actually use the room it has been
	given rather than guessing.
-->
<script lang="ts">
	import { Expand, X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		/** What is being enlarged. The dialog's heading, and the button's label. */
		title: string;
		/** The full-size view. Rendered only while open, and handed the height in
		 *  px that it has to draw in. */
		content: Snippet<[number]>;
	};
	let { title, content }: Props = $props();

	let dialog = $state<HTMLDialogElement | undefined>();
	let open = $state(false);
	let bodyHeight = $state(0);

	/**
	 * `.body`'s own vertical padding, which `clientHeight` includes. Subtracted
	 * here so `content` is handed the room it can actually draw in, rather than
	 * each caller having to know this component's padding. Kept beside the CSS
	 * that sets it.
	 */
	const BODY_PADDING_Y = 14 + 18;
	const room = $derived(Math.max(0, bodyHeight - BODY_PADDING_Y));

	function show() {
		dialog?.showModal();
		open = true;
	}

	/**
	 * A click whose target is the dialog ITSELF landed on the backdrop:
	 * ::backdrop is not a separate event target, so this is how clicking
	 * outside closes it. Clicks on the panel stop at the panel.
	 */
	function onDialogClick(event: MouseEvent) {
		if (event.target === dialog) dialog.close();
	}
</script>

<button class="trigger" onclick={show} title="Show {title} bigger" aria-label="Show {title} bigger">
	<Expand size={15} aria-hidden="true" />
</button>

<dialog
	bind:this={dialog}
	onclick={onDialogClick}
	onclose={() => (open = false)}
	aria-label={title}
>
	<div class="panel">
		<header>
			<h2>{title}</h2>
			<button class="close" onclick={() => dialog?.close()} aria-label="Close">
				<X size={18} aria-hidden="true" />
			</button>
		</header>
		<div class="body" bind:clientHeight={bodyHeight}>
			{#if open}
				{@render content(room)}
			{/if}
		</div>
	</div>
</dialog>

<style lang="scss">
	.trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--alt-field-border);
		border-radius: 9px;
		background: var(--alt-field);
		color: var(--alt-mut);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.trigger:hover {
		background: var(--alt-chip-hover);
		color: var(--alt-tx);
	}

	/*
	 * This is the card, enlarged — so it wears the card's own surface
	 * (`--alt-card` + its blur), not `--alt-modal`. `--alt-modal` is the
	 * navy the handoff gives the nav popups, and at this size it reads as a
	 * blue panel that belongs to nothing on the page; the glass surface is
	 * what the rest of the redesign is built out of.
	 */
	dialog {
		width: min(1680px, 96vw);
		max-width: none;
		height: min(1000px, 93dvh);
		max-height: none;
		padding: 0;
		border: 1px solid var(--alt-card-border);
		border-radius: 28px;
		/*
		 * The page background, with the card's own surface laid over it by
		 * `.panel` below — which is what a card looks like in situ.
		 *
		 * It has to be two elements. `--alt-card` is a translucent GRADIENT in
		 * Glass but a solid COLOUR in Flat and Light, so it cannot be stacked
		 * with an opaque base in one `background` shorthand: a colour is only
		 * legal in the final layer, and `background: var(--alt-card), var(--alt-bg)`
		 * is therefore invalid in two themes out of three.
		 *
		 * An opaque base matters at this size. Left translucent, the Assets
		 * rows behind it ghost straight through the plot — coloured asset
		 * icons and all — and the chart becomes hard to read.
		 */
		background: var(--alt-bg);
		box-shadow: var(--alt-card-shadow);
		color: var(--alt-tx);
		overflow: hidden;
	}
	/* ::backdrop only inherits from the dialog in newer engines; the var()
	   fallback covers the ones where it resolves against nothing. */
	dialog::backdrop {
		background: var(--alt-overlay, rgba(0, 0, 0, 0.55));
		backdrop-filter: var(--alt-overlay-blur, blur(8px));
	}

	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--alt-card);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 18px;
		border-bottom: 1px solid var(--alt-card-border);
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 30px;
		height: 30px;
		padding: 0;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--alt-mut);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}
	.close:hover {
		background: var(--alt-chip-hover);
		color: var(--alt-tx);
	}
	.body {
		flex: 1;
		min-height: 0;
		padding: 14px 18px 18px;
		overflow: auto;
	}

	/* Narrow screens: a near-full-screen sheet. There is no room to be a
	   centred panel, and the point of opening this is the extra room. */
	@media screen and (max-width: 760px) {
		dialog {
			width: 100vw;
			height: 100dvh;
			border: 0;
			border-radius: 0;
		}
	}
</style>
