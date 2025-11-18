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

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (add: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	let coinAmount: CoinAmount<Coin> = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.fromCoin) return;
		if (coinAmount.coin.value === $SendTxDetails.fromCoin.coin.value) {
			const amt = coinAmount.toAmountString();
			if (amt !== $SendTxDetails.fromAmount) $SendTxDetails.fromAmount = amt;
		} else {
			Promise.all([
				coinAmount.convertTo($SendTxDetails.fromCoin.coin, Network.lightning),
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
		if (coinAmount.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = coinAmount.toAmountString();
			if (amt !== $SendTxDetails.toAmount) $SendTxDetails.toAmount = amt;
		} else {
			coinAmount.convertTo($SendTxDetails.toCoin.coin, Network.lightning).then((amt) => {
				if ($SendTxDetails.toAmount !== amt.toAmountString()) {
					$SendTxDetails.toAmount = amt.toAmountString();
				}
			});
		}
	});

	$effect(() => {
		if (!open) return;
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromAmount &&
			$SendTxDetails.fromNetwork &&
			coinAmount.amount > 0
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	const coinOptions: CoinOnNetwork[] = $derived.by(() => {
		let result: CoinOnNetwork[] = [];
		if ($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork) {
			result.push({
				coin: $SendTxDetails.fromCoin.coin,
				network: $SendTxDetails.fromNetwork
			});
		}
		if ($SendTxDetails.toCoin && $SendTxDetails.toNetwork) {
			result.push({
				coin: $SendTxDetails.toCoin.coin,
				network: $SendTxDetails.toNetwork
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
		showEmptyAccounts
	/>
{/if}
<div class={['sections', { hide: assetOpen }]}>
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
