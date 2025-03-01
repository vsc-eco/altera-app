<script lang="ts">
	import { modal } from '$lib/auth/reown';
	import PillButton from '../PillButton.svelte';
	import { _authStore } from './store';
	modal.subscribeAccount((value) => {
		console.log(value);
		_authStore.set({
			status: 'authenticated',
			value: {
				address: value.address
			}
		});
	});
</script>

<PillButton
	onclick={() => {
		_authStore.set({
			status: 'pending'
		});
		modal.open();
	}}>Open Modal</PillButton
>
