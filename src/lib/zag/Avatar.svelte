<script lang="ts">
	import * as avatar from '@zag-js/avatar';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { getProfilePicUrl } from '$lib/auth/hive/getProfilePicUrl';
	import { getUsernameFromDid } from '$lib/getAccountName';
	let { src, did, fallback }: { src?: string; did?: string; fallback?: string } = $props();
	const service = useMachine(avatar.machine, { id: getUniqueId() });
	const api = $derived(avatar.connect(service, normalizeProps));
	$effect(() => {
		if (did == undefined) return;
		if (!did.startsWith('did:pkh:eip155:1')) {
			const username = did.split(':').at(-1)!;
			fallback = username?.slice(0, 2);
			getProfilePicUrl(did.split(':').at(-1)!).then((url) => {
				src = url;
			});
		} else {
			const addr = getUsernameFromDid(did);
			fallback = addr.slice(2, 4);
			src = `https://effigy.im/a/${addr}.svg`;
		}
	});
</script>

<div {...api.getRootProps()}>
	<span {...api.getFallbackProps()} aria-label={`${did ?? ''} PFP`} aria-hidden={api.loaded}
		>{fallback}</span
	>
	<img alt={`${did ?? ''} PFP`} {src} {...api.getImageProps()} />
</div>

<style>
	[data-part='root'] {
		position: relative;
		/* Styles for the root part */
		border-radius: 100%;
		width: 2.5rem;
		flex-shrink: 0;
		padding: -0.5rem -0.5rem;
		box-sizing: border-box;
		background-color: var(--neutral-bg-accent);
		margin: 0 0.1rem;
		aspect-ratio: 1;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	[data-part='fallback'] {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
	}

	[data-part='image'],
	[data-part='fallback'] {
		position: absolute;
		top: 0;
		left: 0;
		/* Styles for the image part */
		width: 100%;
		aspect-ratio: 1;
	}

	/* [data-scope='avatar'][data-part='fallback'] { */
	/* Styles for the fallback part */
	/* } */
</style>
