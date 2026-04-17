<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		style?: string;
		defaultBg?: boolean;
		opaque?: boolean;
	};
	let { children, style = '', defaultBg = false, opaque = false }: Props = $props();
</script>

<div class={[{ defaultBg, opaque }, 'card']} {style}>
	{@render children()}
</div>

<style>
	div {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		overflow: auto;
		max-height: 100%;
		flex: 1 1 auto;
		display: grid;
	}
	div.defaultBg {
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%),
			linear-gradient(
				160deg,
				rgba(111, 106, 248, 0.15) 0%,
				rgba(60, 50, 140, 0.08) 50%,
				transparent 100%
			);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		will-change: transform;
	}
	:global(.light-theme) div.defaultBg {
		background: #ffffff;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	/* Opaque variant: keeps the glass silhouette (rounded corners, inset
	   highlights from --dash-card-shadow, outer shadow, gradient direction)
	   but uses a solid fill so content underneath doesn't bleed through.
	   The gradient stops approximate what the translucent card renders as
	   over the dark canvas, so it visually lines up with glass cards. */
	div.opaque {
		background: linear-gradient(135deg, #20202a 0%, #13131a 100%);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
	:global(.light-theme) div.opaque {
		background: #ffffff;
	}
</style>
