<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import swapOptions, { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import type { ComponentProps } from 'svelte';

	let { next }: { next: () => void } = $props();

	let amount = $state('');
	let inputId = $state('');

	let toOptions = [
		{
			label: Coin.hive.label,
			value: Coin.hive.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hive,
				network: Network.vsc,
				balance: new CoinAmount($accountBalance.bal.hive, Coin.hive, true).toPrettyAmountString()
			}
		},
		{
			label: Coin.hbd.label,
			value: Coin.hbd.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hbd,
				network: Network.vsc,
				balance: new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true).toPrettyAmountString()
			}
		}
	];
	let allowConfirm = $derived(Number(amount) > 0 && $SendTxDetails.toCoin);
</script>

{#snippet toOption(params: ComponentProps<typeof BalanceInfo>)}
	<BalanceInfo {...params} />
{/snippet}

<div class="sections">
	<div class="section">
		<label for={inputId}>Amount</label>
		<AmountInput
			bind:amount
			coinOpt={{ coin: Coin.btc, networks: [Network.lightning] }}
			network={Network.lightning}
			bind:id={inputId}
		/>
	</div>
	<div class="section dest-confirm">
		<div class="select">
			<span class="label-like">Deposit to</span>
			<Select
				items={toOptions}
				onValueChange={(details) => {
					$SendTxDetails.toCoin = swapOptions.to.coins.find(
						(coinOpt) => coinOpt.coin.value === details.value[0]
					);
				}}
				styleType="dropdown"
				placeholder="Select Account"
			/>
		</div>
		<PillButton onclick={() => next()} disabled={!allowConfirm}>Deposit</PillButton>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.dest-confirm {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
        .select {
            flex-grow: 1;
        }
	}
</style>
