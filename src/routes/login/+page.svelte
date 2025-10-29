<script lang="ts">
	import AppKitLogin from '$lib/auth/AppKitLogin.svelte';
	import HiveLogin from '$lib/auth/HiveLogin.svelte';
	import { goto } from '$app/navigation';
	import { getAuth } from '$lib/auth/store';
	import { browser } from '$app/environment';
	import Card from '$lib/cards/Card.svelte';
	let auth = $derived(getAuth()());
	let redirectTo =
		browser && new URL(localStorage.getItem('redirect_url') ?? window.location.origin);
	$effect(() => {
		if (auth?.status == 'authenticated' && browser) {
			localStorage.removeItem('redirect_url');
			if (redirectTo) goto(redirectTo);
		}
	});
</script>

<document:head>
	<title>Login</title>
</document:head>

<main>
	<Card>
		<h1>Altera Login</h1>
		{#if redirectTo && redirectTo.pathname != '/'}
			<p class="continue">
				Login to continue to <span class="redirect">{redirectTo.pathname}</span>
			</p>
		{/if}
		<AppKitLogin />
		<hr />
		<HiveLogin />
	</Card>
	<img src="magi.svg" alt="VSC" />
</main>

<style>
	.continue {
		margin-bottom: 1.5rem;
		margin-top: -1rem;
	}
	.redirect {
		font-family: 'Noto Sans Mono Variable', monospace;
		color: var(--primary-bg-mid);
		text-decoration: underline;
	}
	main {
		margin: auto;
		box-sizing: border-box;
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
		height: 100dvh;
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
		max-width: 48rem;
		min-width: 24rem;
		align-items: stretch;
		justify-content: center;

		flex-direction: column;
		background-color: var(--neutral-bg);
		height: 100%;
		width: 100%;
		box-sizing: border-box;
		padding-top: 1rem;
		overflow: hidden;
		display: flex;
		border-radius: 0;
		align-items: center;
	}

	@media screen and (max-width: 52rem) {
		main > :global(div) {
			max-width: unset;
			min-width: unset;
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
			flex-grow: 0;
			min-width: unset;
			padding: 0;
			padding-top: 4rem;
			aspect-ratio: 1 / 1;
			height: min(256px, 60vw);
			width: min(256px, 60vw);
		}
		main {
			/* background: transparent; */
			flex-direction: column-reverse;
			justify-content: end;
			height: 100dvh;
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
		text-align: center;
	}

	hr {
		position: relative;
		overflow: visible;
		width: calc(100% - 2rem);
		box-sizing: border-box;
		flex-shrink: 1;
		border: 0.5px solid var(--neutral-mid);
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
