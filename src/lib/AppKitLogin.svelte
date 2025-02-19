<script lang="ts">
	import { modal } from '../reown';
	import PillButton from './PillButton.svelte';
</script>

<PillButton
	onclick={() => {
		modal.open();
	}}>Open Modal</PillButton
>
<PillButton
	onclick={() => {
		modal.open({ view: 'Networks' });
	}}>Open Networks</PillButton
>

<appkit-button></appkit-button>
<appkit-network-button></appkit-network-button>
