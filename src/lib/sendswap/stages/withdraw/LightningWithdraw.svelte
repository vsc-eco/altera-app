<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import swapOptions, { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	let amount = $state('');
	let lightningAddress = $state('');

	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.toCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = new CoinAmount(amount, $SendTxDetails.toCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.toAmount)
				$SendTxDetails.toAmount = $SendTxDetails.fromAmount = amt;
		} else {
			new CoinAmount(amount, shownCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amt) => {
					if ($SendTxDetails.toAmount !== amt.toAmountString()) {
						$SendTxDetails.toAmount = $SendTxDetails.fromAmount = amt.toAmountString();
					}
				});
		}
	});

	let toOptions = [
		{
			label: Coin.btc.label,
			value: Coin.btc.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.btc,
				network: Network.lightning
			}
		}
	];

	const max = $derived.by(() => {
		const coin = $SendTxDetails.fromCoin?.coin;
		if (!coin) return;
		if ($accountBalance.bal && coin.value in $accountBalance.bal) {
			return new CoinAmount(
				$accountBalance.bal[coin.value as keyof typeof $accountBalance.bal],
				coin,
				true
			);
		}
	});

	const amountNumber = $derived(parseFloat(amount));
	$effect(() => {
		if (!open) return;
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toNetwork &&
			lightningAddress &&
			amountNumber > 0 &&
			amountNumber <= (max?.toNumber() ?? Number.MAX_SAFE_INTEGER)
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	let possibleCoins: CoinOptions['coins'] = $derived.by(() => {
		let result: CoinOptions['coins'] = [{ coin: Coin.usd, networks: [] }];
		if ($SendTxDetails.toCoin) {
			result = [$SendTxDetails.toCoin, ...result];
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
		$SendTxDetails.toCoin ?? { coin: Coin.usd, networks: [] }
	);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}

	$effect(() => {
		if (open) {
			$SendTxDetails.fromNetwork = Network.magi;
			$SendTxDetails.toNetwork = Network.lightning;
			$SendTxDetails.toUsername = lightningAddress;
		}
	});
</script>

{#snippet toOption(params: ComponentProps<typeof BalanceInfo>)}
	<BalanceInfo {...params} size="medium" />
{/snippet}

<div class="sections">
	<div class="section">
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:amount
					coinOpt={shownCoin}
					network={$SendTxDetails.toNetwork}
					maxAmount={max}
					id="withdraw-amount"
				/>
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
			<span class="label-like">Withdraw Asset</span>
			<Select
				items={toOptions}
				initial={$SendTxDetails.toCoin?.coin.value}
				onValueChange={(details) => {
					if (open) {
						$SendTxDetails.toCoin = $SendTxDetails.fromCoin = swapOptions.to.coins.find(
							(coinOpt) => coinOpt.coin.value === details.value[0]
						);
					}
				}}
				styleType="dropdown"
				placeholder="Select Asset"
			/>
		</div>
	</div>
	<div class="section address-section">
		<label for="lightning-address-input">Lightning Address</label>
		<input
			id="lightning-address-input"
			bind:value={lightningAddress}
			placeholder="Enter Lightning address"
			required
		/>
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
	.address-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		input {
			padding: 0.5rem;
			border: 1px solid var(--neutral-bg-accent);
			border-radius: 0.5rem;
			background-color: var(--neutral-bg);
			color: var(--neutral-fg);
		}
	}
</style>
