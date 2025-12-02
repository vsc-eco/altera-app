<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { type NavButton } from '$lib/sendswap/components/NavButtons.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import axios from 'axios';
	import { Info } from '@lucide/svelte';
	import { is } from '$lib/magiTransactions/eth/cborg_utils/is';

	let { customButton = $bindable() }: { customButton: NavButton } = $props();

	const auth = $derived(getAuth()());
	let coinAmount = $state(new CoinAmount(0, Coin.usd));

	type CoinbaseOnrampURL = {
		onrampUrl: string;
	};

	let isPurchasing = $state(false);

	async function handleSubmit() {
		if (isPurchasing) {
			console.log('Purchase already in progress');
			return;
		}

		if (!auth.value) {
			console.error('null auth value');
			return;
		}

		isPurchasing = true;

		const did = auth.value?.did;

		try {
			const response = await axios.post<CoinbaseOnrampURL>('/api/coinbase', {
				did: did,
				amount: coinAmount.toAmountString()
			});

			if (response.data.onrampUrl) {
				window.location.href = response.data.onrampUrl;
			} else {
				isPurchasing = false;
				console.error('No onramp URL received');
			}
		} catch (error) {
			isPurchasing = false;
			console.error('Failed to create onramp session:', error);
		}
	}

	const minAmount = new CoinAmount(10, Coin.usd);
	$effect(() => {
		customButton = {
			label: isPurchasing ? 'Loading' : 'Deposit',
			action: isPurchasing ? () => {} : handleSubmit,
			disabled: coinAmount.amount < minAmount.amount
		};
	});
</script>

<div class="sections">
	<div class="section">
		<label for="fiat-input">Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={[{ coin: Coin.usd, network: Network.unknown }]}
					{minAmount}
					id="fiat-input"
				/>
			</div>
		</div>
	</div>
	<div class="section warning error">
		<span><Info /> </span>
		<p>
			<b>Warning:&nbsp;</b>This feature is awaiting Coinbase approval. Transactions may be rejected,
			but if processed, funds will be sent to a temporary address and could be lost.
		</p>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}
	.amount-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		.amount-input {
			flex-grow: 1;
			height: 65px;
		}
	}
	.warning {
		padding-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		p {
			line-height: 1.2;
		}
	}
</style>
