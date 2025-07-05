<script>
	import { getAuth } from '$lib/auth/store';
	import { clearAllStores } from '../(authed)/transactions/txStores';
	import { accountBalance, getDefaultBalance } from '$lib/stores/currentBalance';
	import { accountBalanceHistory } from '$lib/stores/balanceHistory';

	let auth = $derived(getAuth()());
	$effect(() => {
		if (auth.value) {
			auth.value.logout();
			clearAllStores();
			accountBalance.set({
				loading: true,
				bal: getDefaultBalance()
			});
			accountBalanceHistory.set([]);
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
