<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { authStore, type Auth } from './store';
	import { browser } from '$app/environment';
	let authState: Auth = $state({ status: 'pending' });
	// to enable the getAuth function call
	setContext('auth', () => authState);
	$effect(() => {
		return authStore.subscribe((newAuth) => {
			authState = newAuth;
		});
	});
	// to make sure that if a user is unauthed that they won't get a flash
	// on load
	let initialPending = $state(true);
	$effect(() => {
		initialPending = initialPending == false ? false : authState.status == 'pending';
	});
	let { children } = $props();
</script>

<div class={{ pending: initialPending }}>
	{@render children()}
</div>

<style>
	div {
		opacity: 1;
		transition: opacity 0.5s;
	}
	div.pending {
		opacity: 0;
	}
</style>
