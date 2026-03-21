<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import Instructions from '$lib/sendswap/components/Instructions.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowLeft, ArrowRightLeft, Coins } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';
	import { get } from 'svelte/store';

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (complete: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// Derived primitives — only change when actual coin/network values change
	const _fromCoinValue = $derived($SendTxDetails.fromCoin?.coin?.value);
	const _toCoinValue = $derived($SendTxDetails.toCoin?.coin?.value);
	const _fromNetwork = $derived($SendTxDetails.fromNetwork?.value);

	function syncAmountFromInput(nextAmount: CoinAmount<Coin>) {
		if (!open) return;
		const amt = nextAmount.toAmountString();
		SendTxDetails.update((details) => {
			if (
				details.fromAmount === amt &&
				details.toAmount === amt &&
				details.enteredAmount === amt
			)
				return details;
			return {
				...details,
				fromAmount: amt,
				toAmount: amt,
				enteredAmount: amt
			};
		});
	}

	// Sync coinAmount → store (only re-runs when coinAmount changes, not on every store mutation)
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.toAmountString();
		SendTxDetails.update((details) => {
			if (
				details.fromAmount === amt &&
				details.toAmount === amt &&
				details.enteredAmount === amt
			)
				return details;
			return {
				...details,
				fromAmount: amt,
				toAmount: amt,
				enteredAmount: amt
			};
		});
	});

	let max = $state(new CoinAmount(0, Coin.hive));

	// Update max when fromCoin or balance changes (uses derived primitives to avoid full store subscription)
	$effect(() => {
		if (!open || !_fromCoinValue || !_fromNetwork) return;
		if (_fromNetwork !== Network.hiveMainnet.value) return;

		const coinValue = _fromCoinValue;
		if (coinValue === Coin.hive.value || coinValue === Coin.hbd.value) {
			const balance = $accountBalance.connectedBal?.[coinValue as 'hive' | 'hbd'];
			if (balance !== undefined) {
				if (max.amount !== balance || max.coin.value !== coinValue) {
					const fromCoin = get(SendTxDetails).fromCoin!.coin;
					max = new CoinAmount(balance, fromCoin, true);
				}
			}
		}
	});

	// Validation — uses derived primitives instead of full store subscription
	$effect(() => {
		if (!open) return;
		const hasCoins = !!_fromCoinValue && !!_toCoinValue;
		const hasNetwork = !!_fromNetwork;
		const amt = coinAmount.amount;
		const maxAmt = max?.amount ?? Number.MAX_SAFE_INTEGER;
		editStage(hasCoins && hasNetwork && amt > 0 && amt <= maxAmt);
	});

	const unkOpt = { coin: Coin.unk, network: Network.unknown };
	const coinOptions: CoinOnNetwork[] = $derived.by(() => {
		if (!_fromCoinValue || !_fromNetwork) return [unkOpt];
		const store = get(SendTxDetails);
		if (!store.fromCoin || !store.fromNetwork) return [unkOpt];
		return [{ coin: store.fromCoin.coin, network: store.fromNetwork }];
	});

	let assetOpen = $state(false);
	const toggleAsset = (open = false) => {
		assetOpen = open;
	};
	$effect(() => {
		secondaryMenu = assetOpen;
	});

	// Ensure toCoin matches fromCoin (runs once on mount)
	$effect(() => {
		SendTxDetails.update((details) => {
			const fromCoin = details.fromCoin;
			const toCoin = details.toCoin;
			const fromValue = fromCoin?.coin.value;
			const toValue = toCoin?.coin.value;

			if (fromCoin && ![Coin.hive.value, Coin.hbd.value].includes(fromCoin.coin.value)) {
				if (!toCoin) return { ...details, fromCoin: undefined };
				return { ...details, fromCoin: undefined, toCoin: undefined };
			}
			if (toValue !== fromValue) {
				return { ...details, toCoin: fromCoin };
			}
			return details;
		});
	});
</script>

{#if assetOpen}
	<div class="back-button">
		<PillButton onclick={() => toggleAsset()} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
	</div>
	<SelectAssetFlattened
		availableCoins={[]}
		close={toggleAsset}
		bind:coin={$SendTxDetails.fromCoin}
		bind:network={$SendTxDetails.fromNetwork}
		bind:max
		externalNetwork={Network.hiveMainnet}
	/>
{:else if auth.value?.provider === 'aioha'}
	<div class="sections">
		<div class="section">
			<label for="asset-card">Deposit From</label>
			<ClickableCard onclick={() => toggleAsset(true)}>
				<div class="asset-card">
					{#if $SendTxDetails.fromCoin && $SendTxDetails.fromNetwork}
						<BalanceInfo
							coin={$SendTxDetails.fromCoin.coin}
							network={$SendTxDetails.fromNetwork}
							size="large"
							styleType="vertical"
						/>
						<!-- <AssetInfo coinOpt={$SendTxDetails.fromCoin} size="medium" /> -->
					{:else}
						<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span
						>
						Select Asset
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
						expressIn={$SendTxDetails.fromCoin?.coin}
						maxAmount={max}
						onAmountChange={syncAmountFromInput}
						bind:id={inputId}
					/>
				</div>
			</div>
		</div>
	</div>
{:else}
	<Instructions />
{/if}

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
