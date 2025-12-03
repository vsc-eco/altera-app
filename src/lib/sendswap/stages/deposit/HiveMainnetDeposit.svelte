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

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (complete: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	$effect(() => {
		if (!open) return;
		if (!$SendTxDetails.fromCoin) return;
		const amt = coinAmount.toAmountString();
		if (amt !== $SendTxDetails.fromAmount)
			$SendTxDetails.fromAmount = $SendTxDetails.toAmount = amt;
	});

	let max = $state(new CoinAmount(0, Coin.hive));
	// Initialize default fromCoin and fromNetwork for Hive Mainnet if not set
	let initialized = $state(false);
	$effect(() => {
		if (open && !initialized && !$SendTxDetails.fromCoin && !$SendTxDetails.fromNetwork) {
			$SendTxDetails.fromCoin = { coin: Coin.hive, networks: [Network.hiveMainnet] };
			$SendTxDetails.fromNetwork = Network.hiveMainnet;
			$SendTxDetails.toCoin = { coin: Coin.hive, networks: [Network.hiveMainnet] };
			initialized = true;
		}
		if (!open) {
			initialized = false;
		}
	});

	$effect(() => {
		if (!open) return;
		const stageComplete =
			!!$SendTxDetails.fromCoin &&
			!!$SendTxDetails.toCoin &&
			!!$SendTxDetails.fromAmount &&
			!!$SendTxDetails.fromNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.amount ?? Number.MAX_SAFE_INTEGER);
		editStage(stageComplete);
	});

	const unkOpt = { coin: Coin.unk, network: Network.unknown };
	const coinOptions: CoinOnNetwork[] = $derived(
		$SendTxDetails.fromCoin && $SendTxDetails.fromNetwork
			? [{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork }]
			: [unkOpt]
	);

	let assetOpen = $state(false);
	const toggleAsset = (open = false) => {
		assetOpen = open;
	};
	$effect(() => {
		secondaryMenu = assetOpen;
	});

	$effect(() => {
		if (
			$SendTxDetails.fromCoin &&
			![Coin.hive.value, Coin.hbd.value].includes($SendTxDetails.fromCoin.coin.value)
		) {
			$SendTxDetails.fromCoin = undefined;
		} else if ($SendTxDetails.toCoin !== $SendTxDetails.fromCoin) {
			$SendTxDetails.toCoin = $SendTxDetails.fromCoin;
		}
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
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					Select Asset
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
						expressIn={$SendTxDetails.fromCoin?.coin}
						maxAmount={max}
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
