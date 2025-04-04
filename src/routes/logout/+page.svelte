<script>
	import { getAuth } from '$lib/auth/store';

	let auth = $derived(getAuth()());
	$effect(() => {
		if (auth.value) {
			auth.value.logout();
		}
	});
</script>

<document:head>
	<title>Logout</title>
</document:head>

<main>
	<h1>Logout</h1>

	<p>You have been logged out. <a href="/login">Log in again</a></p>
</main>

<style>
	main {
		padding: 0.25rem 0.5rem;
		margin: auto;
	}
	h1 {
		margin-top: 0;
	}
</style>
