<script lang="ts">
	import { modal } from '$lib/auth/reown';
	import PillButton from '../PillButton.svelte';
	import { _reownAuthStore } from './store';
</script>

<PillButton
	onclick={(e) => {
		_reownAuthStore.set({
			status: 'pending'
		});
		let target = e.target as HTMLButtonElement;
		target.disabled = true;
		let unsub = _reownAuthStore.subscribe((v) => {
			if (v.status != 'pending') {
				if (target) target.disabled = false;
				unsub();
			}
		});
		modal.open();
	}}>Social/Eth Login</PillButton
>
