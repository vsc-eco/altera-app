<script lang="ts">
	import * as avatar from '@zag-js/avatar';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './Select/idgen';
	let { src, fallback }: { src?: string | null | undefined; fallback: string } = $props();
	const [snapshot, send] = useMachine(avatar.machine({ id: getUniqueId() }));
	const api = $derived(avatar.connect(snapshot, send, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<span {...api.getFallbackProps()}>{fallback}</span>
	<img alt="PA" {src} {...api.getImageProps()} />
</div>

<style>
	[data-scope='avatar'][data-part='root'] {
		/* Styles for the root part */
		border-radius: 100%;
		width: 32px;
		height: 32px;
		margin: 0.5rem 0.1rem;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;

		background: var(--neutral-bg-accent);
	}

	[data-scope='avatar'][data-part='image'] {
		/* Styles for the image part */
		width: 32px;
		aspect-ratio: 1;
	}

	[data-scope='avatar'][data-part='fallback'] {
		/* Styles for the fallback part */
	}
</style>
