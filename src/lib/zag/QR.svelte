<script lang="ts">
	import * as qrCode from '@zag-js/qr-code';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	let { data }: { data: string } = $props();
	const service = $derived(
		useMachine(qrCode.machine, {
			id: getUniqueId(),
			value: data,
			encoding: { ecc: 'Q' },
			pixelSize: 5
		})
	);
	const api = $derived(qrCode.connect(service, normalizeProps));

	// APP-19: only treat the QR payload as a navigable link when it uses an
	// expected safe scheme; otherwise render a non-link container.
	//
	// `has://` is HiveAuth's deeplink scheme (`has://auth_req/<base64>`, the
	// payload aioha hands to `hiveauth.cbWait`). It has to be on this list or
	// the login QR renders as a bare <div> and tapping it on a phone does
	// nothing — the one platform where the deeplink is the whole point, since
	// there is no browser extension to hand the request to.
	const SAFE_QR_SCHEMES = ['https://', 'lightning:', 'has://'];
	const safeHref = $derived(
		typeof data === 'string' && SAFE_QR_SCHEMES.some((scheme) => data.startsWith(scheme))
			? data
			: undefined
	);
</script>

{#if safeHref}
	<a href={safeHref} {...api.getRootProps()}>
		<svg {...api.getFrameProps()}>
			<path {...api.getPatternProps()}></path>
		</svg>
		<div {...api.getOverlayProps()}>
			<img src="magi-padded.svg" alt="" />
		</div>
	</a>
{:else}
	<div {...api.getRootProps()}>
		<svg {...api.getFrameProps()}>
			<path {...api.getPatternProps()}></path>
		</svg>
		<div {...api.getOverlayProps()}>
			<img src="magi-padded.svg" alt="" />
		</div>
	</div>
{/if}

<style>
	[data-part='root'] {
		width: 100%;
		/* Styles for the root part */
		position: relative;
	}

	[data-part='frame'] {
		display: block;
		width: var(--qrcode-width);
		background-color: var(--gray-98);
		aspect-ratio: 1;
		margin: 1rem auto;
		max-width: 100%;
		/* Styles for the svg part */
	}

	[data-part='overlay'] {
		width: 25%;
		aspect-ratio: 1;
		border-radius: 50%;
		overflow: hidden;
	}
	img {
		width: 100%;
	}
</style>
