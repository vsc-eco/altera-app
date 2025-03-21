<script lang="ts">
	import * as qrCode from '@zag-js/qr-code';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './idgen';
	let { data }: { data: string } = $props();
	const service = useMachine(qrCode.machine, {
		id: getUniqueId(),
		value: data,
		encoding: { ecc: 'L' },
		pixelSize: 5
	});
	const api = $derived(qrCode.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<svg {...api.getFrameProps()}>
		<path {...api.getPatternProps()}></path>
	</svg>
	<div {...api.getOverlayProps()}>
		<img src="https://avatars.githubusercontent.com/u/54212428?s=88&v=4" alt="" />
	</div>
</div>

<style>
	[data-part='root'] {
		width: 100%;
		/* Styles for the root part */
	}

	[data-part='frame'] {
		display: block;
		width: var(--qrcode-width);
		background-color: var(--gray-98);
		aspect-ratio: 1;
		margin: 1rem auto;
		/* Styles for the svg part */
	}

	[data-part='overlay'] {
		display: none;
		/* Styles for the logo */
	}
</style>
