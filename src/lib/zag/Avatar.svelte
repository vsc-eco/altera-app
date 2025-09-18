<script lang="ts">
	import * as avatar from '@zag-js/avatar';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	import { getProfilePicUrl } from '$lib/auth/hive/getProfilePicUrl';
	import { getUsernameFromDid } from '$lib/getAccountName';
	let {
		src,
		did,
		fallback,
		large
	}: { src?: string; did?: string; fallback?: string; large?: boolean } = $props();
	const service = useMachine(avatar.machine, { id: getUniqueId() });
	const api = $derived(avatar.connect(service, normalizeProps));
	$effect(() => {
		src = undefined;
		if (did == undefined) return;
		const username = getUsernameFromDid(did);
		fallback = did.startsWith('did:pkh:eip155:1') ? username.slice(2, 4) : username.slice(0, 2);
		getProfilePicUrl(did).then((url) => {
			src = url ?? undefined;
		});
	});
</script>

<div {...api.getRootProps()} class={['wrapper', { large: large ?? false }]}>
	<span {...api.getFallbackProps()} aria-label={`${did ?? ''} PFP`} aria-hidden={api.loaded}
		>{fallback}</span
	>
	<img alt={`${did ?? ''} PFP`} {src} {...api.getImageProps()} />
</div>

<style>
	.wrapper {
		width: 2.5rem;
	}
	.wrapper.large {
		width: 3.5rem;
	}
	[data-part='root'] {
		position: relative;
		/* Styles for the root part */
		border-radius: 100%;
		/* width: 2.5rem; */
		flex-shrink: 0;
		box-sizing: border-box;
		background-color: var(--neutral-bg-accent);
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
	[data-part='fallback'][data-state='hidden'] {
		display: none;
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
