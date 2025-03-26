<script lang="ts">
	import { setContext } from 'svelte';
	import { authStore, type Auth } from './store';
	let authState: Auth = $state({ status: 'pending' });
	setContext('auth', () => authState);
	authStore.subscribe((value) => {
		authState = value;
	});
	let { children } = $props();
</script>

{@render children()}
