<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { Info } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';

	const auth = $derived(getAuth()());

	async function getBtcAddress() {
		if (auth.value) {
			// See note in QuickSwap.svelte: mapping bot has no CORS,
			// so skip the explicit JSON content-type header to avoid
			// the browser's preflight. Go's json decoder ignores
			// the declared type.
			const response = await fetch('https://btc.magi.milohpr.com', {
				method: 'POST',
				body: JSON.stringify({ instruction: `deposit_to=${auth.value.did}` })
			});
			const text = await response.text();
			// Response format: "address mapping (created|exists): <address> -> deposit_to=<did>"
			return text.match(/address mapping (?:created|exists): (\S+)/)?.[1];
		}
	}
</script>

{#if auth.value}
	<div class="sections">
		<div class="section">
			<Card>
				<div class="blurb">
					<span><Info /></span>
					<p>
						Transfer {Coin.btc.value} to this bitcoin address with your favorite wallet or exchange. This
						address is unique to you, and will not change. Please keep in mind that transaction settlement
						time, averages about 30 minutes.
					</p>
				</div>
			</Card>
		</div>
		<div class="section">
			{#await getBtcAddress() then btcAddress}
				{#if btcAddress}
					<Clipboard value={btcAddress} label="Bitcoin Address" disabled={false} />
				{/if}
			{/await}
		</div>
	</div>
{/if}

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.blurb {
		display: flex;
		align-items: center;
		gap: 1rem;
		p {
			line-height: 1.2;
		}
	}
</style>
