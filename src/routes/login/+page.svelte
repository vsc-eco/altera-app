<script>
	import AppKitLogin from '$lib/auth/AppKitLogin.svelte';
	import HiveLogin from '$lib/auth/HiveLogin.svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth/store';
	import { browser } from '$app/environment';
	import Card from '$lib/cards/Card.svelte';

	$effect(() => {
		let unsub = authStore.subscribe((v) => {
			if (v.status == 'authenticated' && browser) {
				const to = localStorage.getItem('redirect_url') ?? '/';
				localStorage.removeItem('redirect_url');
				goto(to);
			}
		});
		return unsub;
	});
</script>

<main>
	<Card>
		<h1>Altera Login</h1>

		<AppKitLogin />
		<hr />
		<HiveLogin />
	</Card>
</main>

<style>
	main {
		padding: 0.5rem 0.5rem;
		margin: auto;
		width: fit-content;
		min-width: 250px;
	}

	h1 {
		margin-top: 0.25rem;
		align-self: center;
	}
	/* targeting div in Card */
	main :global(div) {
		display: flex;
		align-items: stretch;
		flex-direction: column;
	}

	hr {
		position: relative;
		overflow: visible;
		width: calc(100% - 2rem);
		border: 1px solid var(--neutral-fg-accent-shifted);
	}

	hr::after {
		content: 'or';
		color: var(--neutral-fg-accent-shifted);
		position: absolute;
		background-color: var(--neutral-off-bg);
		left: 50%;
		top: 50%;
		padding: 0 0.25rem;
		transform: translate(-50%, -1ex);
	}
</style>
