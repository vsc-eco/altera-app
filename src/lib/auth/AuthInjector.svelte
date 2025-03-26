<script lang="ts">
	import { setContext } from 'svelte';
	import { authStore, type Auth } from './store';
	let authState: Auth = $state({ status: 'pending', value: undefined });
	setContext('auth', authState);
	$effect(() => {
		return authStore.subscribe(({ status, value }) => {
			// necessary to spread because of proxy magic
			authState.status = status;
			authState.value = value;
		});
	});
	let { children } = $props();
</script>

{@render children()}
