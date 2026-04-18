<script lang="ts">
	import { openModal } from '$lib/auth/reown';
	import PillButton from '../PillButton.svelte';
	import { _reownAuthStore, loginRetry } from './store';

	let { namespace }: { namespace?: 'eip155' | 'bip122' } = $props();

	function connect(e: MouseEvent) {
		_reownAuthStore.set({ status: 'pending' });
		let target = e.target as HTMLButtonElement;
		target.disabled = true;
		let unsub = _reownAuthStore.subscribe((v) => {
			if (v.status != 'pending') {
				if (target) target.disabled = false;
				unsub();
			}
		});
		openModal(namespace);
		loginRetry.set('idle');
	}
</script>

<PillButton styleType="outline" onclick={connect}>Connect Wallet</PillButton>
