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

	let toOptions = [
		{
			label: Coin.hive.label,
			value: Coin.hive.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hive,
				network: Network.hiveMainnet
			}
		},
		{
			label: Coin.hbd.label,
			value: Coin.hbd.value,
			snippet: toOption,
			snippetData: {
				coin: Coin.hbd,
				network: Network.hiveMainnet
			}
		}
	];

	let max: CoinAmount<Coin> | undefined = $state();

	$effect(() => {
		if (!open) return;
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromAmount &&
			$SendTxDetails.fromNetwork &&
			coinAmount.amount > 0 &&
			coinAmount.amount <= (max?.toNumber() ?? Number.MAX_SAFE_INTEGER)
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	$effect(() => {
		if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
			$SendTxDetails.toCoin = $SendTxDetails.fromCoin;
		}
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
</script>

{#snippet toOption(params: ComponentProps<typeof BalanceInfo>)}
	<BalanceInfo {...params} size="medium" />
{/snippet}

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
				<!-- <span class="cycle-button">
					<PillButton onclick={cycleShown} styleType="icon">
						<ArrowRightLeft />
					</PillButton>
				</span> -->
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
