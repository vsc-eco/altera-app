<script lang="ts">
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import { getToOption, Coin, Network, type CoinOptions, type AssetOption } from '$lib/sendswap/utils/sendOptions';
	import { useWithdrawState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { editStage, open }: { editStage: (complete: boolean) => void; open: boolean } = $props();

	const txState = useWithdrawState();

	let amount = $state('');
	let lightningAddress = $state('');

	$effect(() => {
		if (!open) return;
		if (!txState.to) return;
		const toCoin = txState.to.coin;
		if (shownCoin.coin.value === toCoin.value) {
			const amt = new CoinAmount(amount, toCoin).toAmountString();
			if (amt !== txState.toAmount)
				txState.toAmount = txState.fromAmount = amt;
		} else {
			new CoinAmount(amount, shownCoin.coin)
				.convertTo(toCoin, Network.lightning)
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
		const from = txState.from;
		if (!from) return;
		return getBalanceAmount($accountBalance, from.coin, from.network);
	});

	const amountNumber = $derived(parseFloat(amount));
	$effect(() => {
		if (!open) return;
		if (
			txState.from &&
			txState.to &&
			txState.toAmount &&
			lightningAddress &&
			amountNumber > 0 &&
			amountNumber <= (max?.toNumber() ?? Number.MAX_SAFE_INTEGER)
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	let possibleCoins: CoinOptions = $derived.by(() => {
		let result: CoinOptions = [{ coin: Coin.usd, networks: [] }];
		if (txState.to) {
			// Synthesize an AssetOption from the CoinOnNetwork so downstream
			// (shownCoin, AmountInput) keeps the {coin, networks} shape it expects.
			result = [{ coin: txState.to.coin, networks: [txState.to.network] }, ...result];
		}
		return result;
	});
	let lastPossibleCoins: CoinOptions = $state([]);
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
	let shownCoin: AssetOption = $state(
		txState.to
			? { coin: txState.to.coin, networks: [txState.to.network] }
			: { coin: Coin.usd, networks: [] }
	);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}

	$effect(() => {
		if (open) {
			// Lightning withdraw rail: from on magi → to on lightning. Parent
			// (WithdrawOptions) sets both before this mounts; these writes are
			// defensive in case the network drifts mid-flow.
			if (txState.from) txState.from = { coin: txState.from.coin, network: Network.magi };
			if (txState.to) txState.to = { coin: txState.to.coin, network: Network.lightning };
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
					network={txState.to?.network}
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
				initial={txState.to?.coin.value}
				onValueChange={(details) => {
					if (!open) return;
					const opt = getToOption(details.value[0]);
					if (!opt) {
						txState.to = undefined;
						txState.from = undefined;
						return;
					}
					txState.to = {
						coin: opt.coin,
						network: txState.to?.network ?? Network.lightning
					};
					txState.from = {
						coin: opt.coin,
						network: txState.from?.network ?? Network.magi
					};
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
