<script lang="ts">
	import * as qrCode from '@zag-js/qr-code';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from './Select/idgen';

	const service = useMachine(qrCode.machine, {
		id: getUniqueId(),
		value: 'https://github.com/chakra-ui'
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
