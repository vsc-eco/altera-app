<script lang="ts">
	import { setContext } from 'svelte';
	import { authStore, type Auth } from './store';
	let authState: Auth = $state({ status: 'pending' });
	setContext('auth', () => authState);
	$effect(() => {
		return authStore.subscribe((newAuth) => {
			// necessary to spread because of proxy magic
			authState = newAuth;
		});
	});
	let { children } = $props();
</script>

{@render children()}
