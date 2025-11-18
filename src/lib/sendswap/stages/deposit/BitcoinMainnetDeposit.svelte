<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import axios from 'axios';
	import { Info } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';

	const auth = $derived(getAuth()());

	type BtcAddressResponse = {
		btc_address: string;
	};

	async function getBtcAddress() {
		if (auth.value) {
			const response = await axios.get<BtcAddressResponse>('/api/btcaddress', {
				params: {
					did: auth.value.did
				}
			});
			return response.data.btc_address;
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
						Transfer {Coin.btc.value} to this bitcoin address with your favorite wallet or exchange.
						This address is unique to you, and will not change. Please keep in mind that bitcoin block
						time, and therefore transaction settlement time, averages about 10 minutes.
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
