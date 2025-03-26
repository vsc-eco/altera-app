<script lang="ts">
	import * as avatar from '@zag-js/avatar';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	let { src, fallback }: { src?: string | null | undefined; fallback: string } = $props();
	const service = useMachine(avatar.machine, { id: getUniqueId() });
	const api = $derived(avatar.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<span {...api.getFallbackProps()}>{fallback}</span>
	<img alt="PA" {src} {...api.getImageProps()} />
</div>

<style>
	[data-scope='avatar'][data-part='root'] {
		/* Styles for the root part */
		border-radius: 100%;
		width: 2.5rem;
		height: 2.5rem;
		box-sizing: border-box;
		margin: 0.5rem 0.1rem;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--neutral-off-fg);
		overflow: hidden;

		background: var(--neutral-bg-accent);
	}

	[data-part='fallback'] {
		height: 1rem;
	}

	[data-part='image'],
	[data-part='fallback'] {
		/* Styles for the image part */
		width: 100%;
		aspect-ratio: 1;
	}

	/* [data-scope='avatar'][data-part='fallback'] { */
	/* Styles for the fallback part */
	/* } */
</style>
