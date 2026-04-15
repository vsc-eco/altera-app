<script lang="ts">
	import { openModal } from '$lib/auth/reown';
	import PillButton from '../PillButton.svelte';
	import { _reownAuthStore, loginRetry } from './store';
</script>

<PillButton
	styleType="outline"
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
		openModal();
		loginRetry.set('idle');
	}}>Connect Wallet</PillButton
>
