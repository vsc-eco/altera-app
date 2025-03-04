<script lang="ts">
	import { modal } from '$lib/auth/reown';
	import PillButton from '../PillButton.svelte';
	import { _reownAuthStore } from './store';
</script>

<PillButton
	onclick={() => {
		_reownAuthStore.set({
			status: 'pending'
		});
		modal.open();
	}}>Social/Eth Login</PillButton
>
