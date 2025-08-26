<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import { optionsEqual, SendTxDetails, solveNetworkConstraints } from '$lib/send/sendUtils';
	import SelectAsset from '$lib/send/stages/amount/SelectAsset.svelte';
	import { assetCard, type AssetObject } from '$lib/send/stages/components/SendSnippets.svelte';
	import type { Snippet } from 'svelte';
	import SelectAssetStack from './assetSelection/SelectAssetStack.svelte';
	import AssetInfo from '$lib/send/stages/components/AssetInfo.svelte';
	import swapOptions, { Coin, type CoinOptions } from '$lib/send/sendOptions';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowRightLeft } from '@lucide/svelte';

	let {
		id,
		editStage,
		openSnippet,
		closeSnippet
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
		openSnippet: (snippet: (...args: any[]) => ReturnType<Snippet>, args?: any) => void;
		closeSnippet: (all?: boolean) => void;
	} = $props();

	const auth = $derived($authStore);

	let { assetOptions, accountOptions, networkOptions } = $state<
		ReturnType<typeof solveNetworkConstraints>
	>({ assetOptions: [], accountOptions: [], networkOptions: [] });
	$effect(() => {
		const {
			assetOptions: newAssetOptions,
			accountOptions: newAccountOptions,
			networkOptions: newNetworkOptions
		} = solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			$SendTxDetails.toNetwork,
			auth.value?.did,
			$SendTxDetails.account,
			$SendTxDetails.fromNetwork,
			true
		);
		if (!optionsEqual(newAssetOptions, assetOptions)) {
			assetOptions = newAssetOptions;
		}
		if (!optionsEqual(newAccountOptions, accountOptions)) {
			accountOptions = newAccountOptions;
		}
		if (!optionsEqual(newNetworkOptions, networkOptions)) {
			networkOptions = newNetworkOptions;
		}
	});

	const fromAssetObjs: AssetObject[] = $derived(
		assetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.fromNetwork, size: 'medium' },
			disabled: opt.disabled,
			disabledMemo: opt.disabledMemo
		}))
	);
	const toAssetObjs: AssetObject[] = $derived(
		swapOptions.to.coins.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.fromNetwork, size: 'medium' }
		}))
	);
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
	let shownIndex = $state(0);
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
	}
	let shownCoin: CoinOptions['coins'][number] = $derived(possibleCoins[shownIndex]);
	let toAmount = $state('');
</script>

{#snippet assetSelection(toFrom: 'to' | 'from')}
	{#if toFrom === 'from'}
		<SelectAssetStack
			availableCoins={fromAssetObjs}
			bind:coin={$SendTxDetails.fromCoin}
			bind:network={$SendTxDetails.fromNetwork}
			push={openSnippet}
			pop={closeSnippet}
		/>
	{:else}
		<SelectAssetStack
			availableCoins={toAssetObjs}
			bind:coin={$SendTxDetails.toCoin}
			bind:network={$SendTxDetails.toNetwork}
			push={openSnippet}
			pop={closeSnippet}
		/>
	{/if}
{/snippet}

<h2>Swap</h2>
<div class="coin-options">
	<ClickableCard onclick={() => openSnippet(assetSelection, 'from')}>
		<div class="asset-wrapper">
			{#if $SendTxDetails.fromCoin}
				<AssetInfo
					coinOpt={$SendTxDetails.fromCoin}
					network={$SendTxDetails.fromNetwork}
					size="medium"
				/>
			{:else}
				Select Source
			{/if}
		</div>
	</ClickableCard>
	<ClickableCard onclick={() => openSnippet(assetSelection, 'to')}>
		<div class="asset-wrapper">
			{#if $SendTxDetails.toCoin}
				<AssetInfo
					coinOpt={$SendTxDetails.toCoin}
					network={$SendTxDetails.toNetwork}
					size="medium"
				/>
			{:else}
				Select Destination
			{/if}
		</div>
	</ClickableCard>
</div>
<div class="amount">
	<div class="amount-input">
		<AmountInput
			bind:amount={toAmount}
			coin={shownCoin}
			network={$SendTxDetails.toNetwork}
			styleType="big"
		/>
	</div>
	<span class="cycle-button">
		<PillButton onclick={cycleShown} styleType="icon">
			<ArrowRightLeft />
		</PillButton>
	</span>
</div>

<style lang="scss">
	.coin-options {
		display: flex;
		gap: 1rem;
		.asset-wrapper {
			min-height: 3.5rem;
			padding: 0.5rem;
			display: flex;
			align-items: center;
			text-align: center;
		}
		@media screen and (max-width: 450px) {
			flex-wrap: wrap;
		}
	}
	.amount {
		margin-top: 1.5rem;
	}
</style>
