<script lang="ts">
	import SendSwap from '$lib/sendswap/SendSwap.svelte';
	import LandingSections from '$lib/landing/LandingSections.svelte';
	import { getAuth } from '$lib/auth/store';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	/**
	 * The redesign gives Pools its own page, so the swap screen is one task and
	 * one card. The old tabbed links (`/swap?tab=pools`, `?tab=custom-pools`)
	 * are still in the sidebar and in the wild, so they are forwarded rather
	 * than broken.
	 */
	/** The pitch below the card is for people who have not connected yet.
	 *  Once you have an account it is just a long scroll past your own app. */
	const connected = $derived(!!getAuth()().value);

	$effect(() => {
		const tab = page.url.searchParams.get('tab');
		if (tab === 'pools') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version
			goto('/pools', { replaceState: true });
		} else if (tab === 'custom-pools') {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version
			goto('/pools?kind=custom', { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>Swap</title>
</svelte:head>

<div class="swap-screen">
	<a class="eyebrow" href="https://magiprotocol.com" target="_blank" rel="noopener noreferrer">
		<span class="dot" aria-hidden="true"></span>
		POWERED BY MAGI NETWORK
	</a>

	<h1>Swap native assets &ndash; no wrapping, no bridges.</h1>

	<SendSwap txType="swap" />

	<div class="tags">
		<span>Zero Fees</span>
		<span>Non-Custodial</span>
		<span>Any Wallet</span>
	</div>
</div>

{#if !connected}
	<!-- Full-bleed: the shell caps a task page's children at 760px, and these
	     sections were drawn for the whole width. The negative inline margin
	     walks back out of that column. -->
	<div class="landing-below" data-fullbleed>
		<LandingSections />
	</div>
{/if}

<style lang="scss">
	.landing-below {
		/* Width comes from the shell: `data-fullbleed` on the element above
		   opts it out of the task column and cancels `main`'s padding. */
		margin-top: 40px;
		/* The marquee inside is wider than the viewport by design; clip it here
		   so it cannot add a horizontal scrollbar to the whole page. */
		overflow-x: clip;
	}

	.swap-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
	}

	/* The card is the task surface and stays at the spec's 470px, while the
	   heading above it uses the full column. */
	.swap-screen :global(.send-internal-wrapper) {
		width: 100%;
		max-width: 470px;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 6px 14px;
		border-radius: 999px;
		border: 1px solid var(--alt-card-border);
		background: var(--alt-chip);
		color: var(--alt-tx-2);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-decoration: none;
		white-space: nowrap;
	}
	.eyebrow:hover {
		color: var(--alt-tx);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--alt-green);
		box-shadow: 0 0 8px var(--alt-green);
	}

	h1 {
		margin: 18px 0 28px;
		text-align: center;
		font-size: clamp(34px, 5.4vw, 56px);
		font-weight: 700;
		line-height: 1.06;
		letter-spacing: -0.025em;
		text-wrap: balance;
		color: var(--alt-tx);
	}

	.tags {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 18px;
	}
	.tags span {
		padding: 6px 14px;
		border-radius: 999px;
		border: 1px solid var(--alt-card-border);
		color: var(--alt-tx-2);
		font-size: 12px;
		font-weight: 600;
	}
</style>
