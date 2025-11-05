<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import swapOptions, { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { getFee, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { editStage, open }: { editStage: (add: boolean) => void; open: boolean } = $props();

	let amount = $state('');
	let inputId = $state('');

	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.fromCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.fromCoin.coin.value) {
			const amt = new CoinAmount(amount, $SendTxDetails.fromCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.fromAmount) $SendTxDetails.fromAmount = amt;
		} else {
			Promise.all([
				new CoinAmount(amount, shownCoin.coin).convertTo(
					$SendTxDetails.fromCoin.coin,
					Network.lightning
				),
				getFee($SendTxDetails.toAmount)
			]).then(([amt, fee]) => {
				if ($SendTxDetails.fromAmount !== amt.toAmountString()) {
					$SendTxDetails.fromAmount = amt.toAmountString();
				}
				if (
					fee?.amount !== $SendTxDetails.fee?.amount ||
					fee?.coin.value !== $SendTxDetails.fee?.coin.value
				) {
					$SendTxDetails.fee = fee;
				}
			});
		}
	});
	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.toCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = new CoinAmount(amount, $SendTxDetails.toCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.toAmount) $SendTxDetails.toAmount = amt;
		} else {
			new CoinAmount(amount, shownCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amt) => {
					if ($SendTxDetails.toAmount !== amt.toAmountString()) {
						$SendTxDetails.toAmount = amt.toAmountString();
					}
				});
		}
	});

	let toOptions = [
		{
			label: Coin.hive.label,
			value: Coin.hive.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hive,
				network: Network.magi,
				balance: new CoinAmount($accountBalance.bal.hive, Coin.hive, true).toPrettyAmountString()
			}
		},
		{
			label: Coin.hbd.label,
			value: Coin.hbd.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hbd,
				network: Network.magi,
				balance: new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true).toPrettyAmountString()
			}
		}
	];

	const amountNumber = $derived(parseFloat(amount));
	$effect(() => {
		if (!open) return;
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromAmount &&
			$SendTxDetails.fromNetwork &&
			amountNumber > 0
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	let possibleCoins: CoinOptions['coins'] = $derived.by(() => {
		let result: CoinOptions['coins'] = [{ coin: Coin.usd, networks: [] }];
		if ($SendTxDetails.fromCoin) {
			result.push($SendTxDetails.fromCoin);
		}
		if ($SendTxDetails.toCoin) {
			result.push($SendTxDetails.toCoin);
		}
		return result;
	});
	let lastPossibleCoins: CoinOptions['coins'] = $state([]);
	$effect(() => {
		possibleCoins;
		untrack(() => {
			if (!open) return;
			if (
				!lastPossibleCoins.some((coinOpt) => coinOpt.coin.value !== Coin.usd.value) &&
				possibleCoins.some((coinOpt) => coinOpt.coin.value !== Coin.usd.value)
			) {
				shownIndex = possibleCoins.findIndex((coinOpt) => coinOpt.coin.value !== Coin.usd.value);
			} else {
				const index = possibleCoins.findIndex(
					(coinOpt) => coinOpt.coin.value === shownCoin.coin.value
				);
				if (index >= 0) {
					shownIndex = index;
				} else {
					if (shownIndex > possibleCoins.length - 1) {
						shownIndex = 0;
					}
				}
			}
			shownCoin = possibleCoins[shownIndex];
			lastPossibleCoins = possibleCoins;
		});
	});

	let shownIndex = $state(0);
	let shownCoin: CoinOptions['coins'][number] = $state(
		$SendTxDetails.fromCoin ?? { coin: Coin.usd, networks: [] }
	);
	let shownNetwork = $derived(
		shownCoin.coin.value === $SendTxDetails.fromCoin?.coin.value
			? $SendTxDetails.fromNetwork
			: shownCoin.coin.value === $SendTxDetails.toCoin?.coin.value
				? $SendTxDetails.toNetwork
				: Network.unknown
	);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}
</script>

{#snippet toOption(params: ComponentProps<typeof BalanceInfo>)}
	<BalanceInfo {...params} size="medium" styleType="quiet" />
{/snippet}

<div class="sections">
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput bind:amount coinOpt={shownCoin} network={shownNetwork} bind:id={inputId} />
			</div>
			<span class="cycle-button">
				<PillButton onclick={cycleShown} styleType="icon">
					<ArrowRightLeft />
				</PillButton>
			</span>
		</div>
	</div>
	<div class="section dest-confirm">
		<div class="select">
			<span class="label-like">Deposit to</span>
			<Select
				items={toOptions}
				initial={$SendTxDetails.toCoin?.coin.value}
				onValueChange={(details) => {
					if (open) {
						$SendTxDetails.toCoin = swapOptions.to.coins.find(
							(coinOpt) => coinOpt.coin.value === details.value[0]
						);
					}
				}}
				styleType="dropdown"
				placeholder="Select Account"
			/>
		</div>
	</div>
</div>

<style lang="scss">
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
		.cycle-button {
			:global(button) {
				margin: 0;
				margin-top: 2px;
			}
		}
	}
	.dest-confirm {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		.select {
			flex-grow: 1;
			:global([data-scope='select'][data-part='control']) {
				height: 52px;
			}
		}
	}
</style>
