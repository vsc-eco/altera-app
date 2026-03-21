<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import { Coin, Network, type CoinOnNetwork } from '$lib/sendswap/utils/sendOptions';
	import { getFee, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { ArrowLeft, Coins } from '@lucide/svelte';
	import { get } from 'svelte/store';
	import { untrack } from 'svelte';

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (add: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	let coinAmount: CoinAmount<Coin> = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// Derived primitives from store — only change when the actual values change,
	// preventing effects from re-running on every unrelated store mutation
	const _fromCoinValue = $derived($SendTxDetails.fromCoin?.coin?.value);
	const _toCoinValue = $derived($SendTxDetails.toCoin?.coin?.value);
	const _fromNetwork = $derived($SendTxDetails.fromNetwork?.value);
	const _toNetwork = $derived($SendTxDetails.toNetwork?.value);

	// Sync coinAmount → fromAmount, toAmount, fee atomically
	// Single effect to avoid race conditions between separate from/to effects
	$effect(() => {
		if (!open) return;
		const fromCoinVal = _fromCoinValue;
		const toCoinVal = _toCoinValue;
		if (!fromCoinVal) return;
		const amt = coinAmount.toAmountString();
		const coinVal = coinAmount.coin.value;
		const coinAmountSnapshot = coinAmount;
		untrack(() => {
			const store = get(SendTxDetails);
			if (!store.fromCoin) return;

			// Compute fromAmount
			if (coinVal === fromCoinVal) {
				if (amt !== store.fromAmount || amt !== store.enteredAmount) {
					SendTxDetails.update((s) => ({ ...s, fromAmount: amt, enteredAmount: amt }));
				}
			} else {
				coinAmountSnapshot
					.convertTo(store.fromCoin.coin, Network.lightning)
					.then((converted) => {
						const current = get(SendTxDetails);
						const convertedAmt = converted.toAmountString();
						if (current.fromAmount !== convertedAmt) {
							SendTxDetails.update((s) => ({
								...s,
								fromAmount: convertedAmt,
								enteredAmount: convertedAmt
							}));
						}
					});
			}

			// Compute toAmount
			if (!store.toCoin || !toCoinVal) return;
			if (coinVal === toCoinVal) {
				if (amt !== store.toAmount) {
					SendTxDetails.update((s) => ({ ...s, toAmount: amt }));
				}
			} else {
				coinAmountSnapshot
					.convertTo(store.toCoin.coin, Network.lightning)
					.then((converted) => {
						const current = get(SendTxDetails);
						const convertedAmt = converted.toAmountString();
						if (current.toAmount !== convertedAmt) {
							SendTxDetails.update((s) => ({ ...s, toAmount: convertedAmt }));
						}
						// Compute fee based on converted toAmount
						getFee(convertedAmt).then((fee) => {
							const latest = get(SendTxDetails);
							if (
								fee?.amount !== latest.fee?.amount ||
								fee?.coin.value !== latest.fee?.coin.value
							) {
								SendTxDetails.update((s) => ({ ...s, fee }));
							}
						});
					});
			}
		});
	});

	// Validation — only re-runs when coin/network presence or coinAmount changes
	$effect(() => {
		if (!open) return;
		const hasCoins = !!_fromCoinValue && !!_toCoinValue;
		const hasNetwork = !!_fromNetwork;
		const amt = coinAmount.amount;
		untrack(() => {
			const store = get(SendTxDetails);
			if (hasCoins && store.fromAmount && hasNetwork && amt > 0) {
				editStage(true);
			} else {
				editStage(false);
			}
		});
	});

	// Coin options derived — uses primitives so it only recalculates when coins/networks actually change
	const coinOptions: CoinOnNetwork[] = $derived.by(() => {
		let result: CoinOnNetwork[] = [];
		// Read derived primitives to track only actual value changes
		const fCoin = _fromCoinValue;
		const tCoin = _toCoinValue;
		const fNet = _fromNetwork;
		const tNet = _toNetwork;
		// Use get() to access the full objects without subscribing the derived to the whole store
		const store = get(SendTxDetails);
		if (fCoin && fNet && store.fromCoin && store.fromNetwork) {
			result.push({
				coin: store.fromCoin.coin,
				network: store.fromNetwork
			});
		}
		if (tCoin && tNet && store.toCoin && store.toNetwork) {
			result.push({
				coin: store.toCoin.coin,
				network: store.toNetwork
			});
		}
		if (result.map((coinOpt) => coinOpt.coin.value).includes(Coin.btc.value)) {
			result.push({ coin: Coin.sats, network: Network.lightning });
		}
		if (result.length === 0) {
			result.push({ coin: Coin.unk, network: Network.unknown });
		}
		return result;
	});

	let assetOpen = $state(false);
	const toggleAsset = (open = false) => {
		assetOpen = open;
	};
	$effect(() => {
		secondaryMenu = assetOpen;
	});
</script>

{#if assetOpen}
	<div class="back-button">
		<PillButton onclick={() => toggleAsset()} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
	</div>
	<SelectAssetFlattened
		availableCoins={[Coin.hive, Coin.hbd]}
		close={toggleAsset}
		bind:coin={$SendTxDetails.toCoin}
		bind:network={$SendTxDetails.toNetwork}
		isTo
	/>
{/if}
<div class={['sections', { hide: assetOpen }]}>
	<div class="deposit section">
		<label for="asset-card">Deposit To</label>
		<ClickableCard onclick={() => toggleAsset(true)}>
			<div class="asset-card">
				{#if $SendTxDetails.toCoin && $SendTxDetails.toNetwork}
					<BalanceInfo
						coin={$SendTxDetails.toCoin.coin}
						network={$SendTxDetails.toNetwork}
						size="large"
						styleType="vertical"
					/>
					<!-- <AssetInfo coinOpt={$SendTxDetails.fromCoin} size="medium" /> -->
				{:else}
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					Select Destination Account
				{/if}
				<span class="edit"> Edit </span>
			</div>
		</ClickableCard>
	</div>
	<div class="section">
		<label for={inputId}>Amount</label>
		<div class="amount-row">
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={coinOptions}
					bind:id={inputId}
					minAmount={new CoinAmount(250, Coin.sats)}
				/>
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		&.hide {
			display: none;
		}
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
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem;
		.edit {
			margin-left: auto;
		}
	}
</style>
