<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Instructions from '$lib/sendswap/components/Instructions.svelte';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import axios from 'axios';

	const auth = $derived(getAuth()());
	let amount = $state('');

	type CoinbaseOnrampURL = {
		onrampUrl: string;
	};

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

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
</script>

{#if auth.value?.provider === 'aioha'}
	<form onsubmit={handleSubmit}>
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

			<div class="form-action">
				<PillButton type="submit" onclick={() => null}>
					<span>Buy</span>
				</PillButton>
			</div>
		</div>
	</form>
{:else}
	<Instructions />
{/if}

<style lang="scss">
	.form-action {
		display: flex;
		justify-content: center;
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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
