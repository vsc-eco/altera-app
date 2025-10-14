<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { type NavButton } from '$lib/sendswap/components/NavButtons.svelte';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import axios from 'axios';

	let { customButton = $bindable() }: { customButton: NavButton } = $props();

	const auth = $derived(getAuth()());
	let amount = $state('');

	type CoinbaseOnrampURL = {
		onrampUrl: string;
	};

	async function handleSubmit() {
		if (!auth.value) {
			console.error('null auth value');
			return;
		}

		const did = auth.value?.did;
		const response = await axios.get<CoinbaseOnrampURL>('/api/coinbase', {
			params: {
				did: did,
				amount: amount
			}
		});
		window.location.href = response.data.onrampUrl;
	}
	const amountNumber = $derived(Number(amount));
	$inspect(amountNumber);
	$effect(() => {
		customButton = {
			label: 'Buy',
			action: handleSubmit,
			disabled: amountNumber <= 0
		};
	});
</script>

<div class="sections">
	<div class="section">
		<label for="fiat-input">Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:amount
					coinOpt={{ coin: Coin.usd, networks: [] }}
					network={undefined}
					maxAmount={undefined}
					id="fiat-input"
				/>
			</div>
		</div>
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
</style>
