<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import swapOptions, { Coin, Network, type CoinOptions } from '$lib/sendswap/utils/sendOptions';
	import { useTxState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const txState = useTxState();

	let amount = $state('');
	let lightningAddress = $state('');

	$effect(() => {
		if (!open) return;
		if (!txState.toCoin) return;
		if (shownCoin.coin.value === txState.toCoin.coin.value) {
			const amt = new CoinAmount(amount, txState.toCoin.coin).toAmountString();
			if (amt !== txState.toAmount)
				txState.toAmount = txState.fromAmount = amt;
		} else {
			new CoinAmount(amount, shownCoin.coin)
				.convertTo(txState.toCoin.coin, Network.lightning)
				.then((amt) => {
					if (txState.toAmount !== amt.toAmountString()) {
						txState.toAmount = txState.fromAmount = amt.toAmountString();
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
		const coin = txState.fromCoin?.coin;
		const network = txState.fromNetwork;
		if (!coin || !network) return;
		return getBalanceAmount($accountBalance, coin, network);
	});

	const amountNumber = $derived(parseFloat(amount));
	$effect(() => {
		if (!open) return;
		if (
			txState.fromCoin &&
			txState.toCoin &&
			txState.toAmount &&
			txState.toNetwork &&
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
		if (txState.toCoin) {
			result = [txState.toCoin, ...result];
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
		txState.toCoin ?? { coin: Coin.usd, networks: [] }
	);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}

	$effect(() => {
		if (open) {
			txState.fromNetwork = Network.magi;
			txState.toNetwork = Network.lightning;
			txState.toUsername = lightningAddress;
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
					network={txState.toNetwork}
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
				initial={txState.toCoin?.coin.value}
				onValueChange={(details) => {
					if (open) {
						txState.toCoin = txState.fromCoin = swapOptions.to.coins.find(
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
	}
</style>
