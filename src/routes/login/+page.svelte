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
	<img src="vsc.png" alt="VSC" />
</main>

<style>
	main {
		margin: auto;
		box-sizing: border-box;
		min-width: 250px;
		display: flex;
		align-items: center;
	}

	main {
		background: linear-gradient(
			-30deg in oklab,
			var(--teal-40),
			var(--teal-80) 30%,
			var(--salmon-80),
			var(--salmon-60),
			var(--teal-60)
		);
		/* background-image: url(/blue-waves-txt.png);
		background-size: cover;
		background-position: 50vw -25%;
		background-repeat: no-repeat; */
		z-index: 100;
	}

	img {
		width: 40vmin;
		max-width: 256px;
		min-width: 22rem;
		padding: 4rem 5%;
		margin: auto;
		/* opacity: 0; */
		display: flex;
		justify-content: center;
		align-items: center;
		flex: 1;
		flex-shrink: 1;
	}

	/* targeting div in Card */
	main :global(div) {
		display: flex;
		max-width: 48rem;
		min-width: 24rem;
		align-items: stretch;
		justify-content: center;

		flex-direction: column;
		background-color: var(--neutral-bg);
	}

	main > :global(div) {
		width: 100%;
		box-sizing: border-box;
		padding-top: 1rem;
		overflow: hidden;
		height: 100%;
		display: flex;
		border-radius: 0;
		align-items: center;
	}

	@media screen and (max-width: 52rem) {
		main > :global(div) {
			max-width: unset;
			width: 100%;
			box-sizing: border-box;
			flex-grow: 1;
			aspect-ratio: 1 / 1;
			padding-top: 1rem;
			height: max-content;
			background: linear-gradient(to bottom in oklab, transparent, var(--neutral-bg) 40%);
			border: none;
			justify-content: center;
		}
		main > img {
			min-width: unset;
			padding: 0;
			padding-top: 4rem;
			aspect-ratio: 1 / 1;
			width: 256px;
			height: 256px;
		}
		main {
			/* background: transparent; */
			flex-direction: column-reverse;
			justify-content: end;
			background-position: 0 -50%;
		}
	}

	main :global(button) {
		width: 100%;
		box-sizing: border-box;
	}

	h1 {
		margin-top: 0.25rem;
		align-self: center;
		margin-bottom: 2rem;
	}

	main {
		height: 100%;
	}

	hr {
		position: relative;
		overflow: visible;
		width: calc(100% - 2rem);
		border: 1px solid var(--neutral-mid);
	}

	hr::after {
		content: 'or';
		color: var(--neutral-mid);
		position: absolute;
		background-color: var(--neutral-bg);
		left: 50%;
		top: 50%;
		padding: 0 0.25rem;
		transform: translate(-50%, -1ex);
	}
</style>
