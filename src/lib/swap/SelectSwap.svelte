<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import {
		getFee,
		optionsEqual,
		SendTxDetails,
		solveNetworkConstraints
	} from '$lib/send/sendUtils';
	import { assetCard, type AssetObject } from '$lib/send/stages/components/SendSnippets.svelte';
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import SelectAssetStack from './assetSelection/SelectAssetStack.svelte';
	import AssetInfo from '$lib/send/stages/components/AssetInfo.svelte';
	import swapOptions, { Coin, Network, type CoinOptions } from '$lib/send/sendOptions';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import {
		ArrowDownRight,
		ArrowRightLeft,
		ArrowUpRight,
		Car,
		EqualApproximately
	} from '@lucide/svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import {
		updateHistoricalData,
		HistoricalCoinData,
		loadHistoricalCoinData,
		saveHistoricalCoinData,
		type CoinMarketMapData
	} from '$lib/currency/historical';
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import Card from '$lib/cards/Card.svelte';
	import moment from 'moment';

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

	onMount(() => {
		loadHistoricalCoinData();
	});
	onDestroy(() => {
		saveHistoricalCoinData();
	});

	const auth = $derived($authStore);

	$effect(() => {
		if (
			$SendTxDetails.toNetwork &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toAmount !== '0' &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.fromAmount &&
			$SendTxDetails.fromAmount !== '0' &&
			$SendTxDetails.fromCoin
		) {
			editStage(id, true);
			untrack(() => {
				getFee($SendTxDetails.toAmount).then((fee) => {
					if (
						fee?.amount !== $SendTxDetails.fee?.amount ||
						fee?.coin.value !== $SendTxDetails.fee?.coin.value
					)
						$SendTxDetails.fee = fee;
				});
			});
		} else {
			editStage(id, false);
		}
	});

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
	$effect(() => {
		possibleCoins;
		untrack(() => {
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
			shownCoin = possibleCoins[shownIndex];
		});
	});
	let shownIndex = $state(0);
	let shownCoin: CoinOptions['coins'][number] = $state({ coin: Coin.usd, networks: [] });
	function cycleShown() {
		shownIndex = (shownIndex + 1) % possibleCoins.length;
		shownCoin = possibleCoins[shownIndex];
	}
	let inputAmount = $state('');
	$effect(() => {
		if (!$SendTxDetails.fromCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.fromCoin.coin.value) {
			const amt = new CoinAmount(inputAmount, $SendTxDetails.fromCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.fromAmount) $SendTxDetails.fromAmount = amt;
		} else {
			new CoinAmount(inputAmount, shownCoin.coin)
				.convertTo($SendTxDetails.fromCoin.coin, Network.lightning)
				.then((amt) => {
					if ($SendTxDetails.fromAmount !== amt.toAmountString()) {
						$SendTxDetails.fromAmount = amt.toAmountString();
					}
				});
		}
	});
	$effect(() => {
		if (!$SendTxDetails.toCoin) return;
		if (shownCoin.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = new CoinAmount(inputAmount, $SendTxDetails.toCoin.coin).toAmountString();
			if (amt !== $SendTxDetails.toAmount) $SendTxDetails.toAmount = amt;
		} else {
			new CoinAmount(inputAmount, shownCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amt) => {
					if ($SendTxDetails.toAmount !== amt.toAmountString()) {
						$SendTxDetails.toAmount = amt.toAmountString();
					}
				});
		}
	});

	let fromInUsd = $state('');
	let fromInTo = $state('');
	let toInUsd = $state('');
	$effect(() => {
		if ($SendTxDetails.fromCoin) {
			const oneFrom = new CoinAmount(1, $SendTxDetails.fromCoin.coin);
			oneFrom.convertTo(Coin.usd, Network.lightning).then((amt) => {
				fromInUsd = amt.toPrettyMinFigs();
			});
			if ($SendTxDetails.toCoin) {
				oneFrom.convertTo($SendTxDetails.toCoin.coin, Network.lightning).then((amt) => {
					fromInTo = amt.toPrettyMinFigs();
				});
			}
		}
		if ($SendTxDetails.toCoin) {
			new CoinAmount(1, $SendTxDetails.toCoin.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amt) => {
					toInUsd = amt.toPrettyMinFigs();
				});
		}
	});
	// map of coin value (NOT ucid) fields to historical data
	let graphsLoaded = $state(new Set<string>());
	let fromData: CoinMarketMapData | undefined = $state();
	let toData: CoinMarketMapData | undefined = $state();
	let hoveredFromPoint: Point | undefined = $state();
	let hoveredToPoint: Point | undefined = $state();
	let lastDefined = $state.raw(new Set<string>());
	$effect(() => {
		let currentlyDefined = [$SendTxDetails.fromCoin?.coin, $SendTxDetails.toCoin?.coin].filter(
			(coin) => coin !== undefined
		);
		untrack(() => {
			const definedSet = new Set(currentlyDefined.map((coin) => coin.value));
			if (definedSet.symmetricDifference(lastDefined).size === 0) return;
			lastDefined = definedSet;
			graphsLoaded = graphsLoaded.intersection(definedSet);

			updateHistoricalData(currentlyDefined).then(() => {
				graphsLoaded = graphsLoaded.union(definedSet);
				if ($SendTxDetails.fromCoin && $SendTxDetails.fromCoin.coin.ucid) {
					fromData = $HistoricalCoinData.get($SendTxDetails.fromCoin.coin.ucid);
				}
				if ($SendTxDetails.toCoin && $SendTxDetails.toCoin.coin.ucid) {
					toData = $HistoricalCoinData.get($SendTxDetails.toCoin.coin.ucid);
				}
			});
		});
	});
	function getPercentChange(points: Point[] | undefined, current?: number) {
		if (!points || points.length === 0) return 0;
		const first = points[0].value;
		const last = points[points.length - 1].value;
		return (last / first - 1) * 100;
	}
	const graphValueFormatter = new Intl.NumberFormat(navigator.language, {
		useGrouping: true,
		maximumFractionDigits: 5
	});

	const minAmount = $derived(
		possibleCoins.some((coin) => coin.coin.value === Coin.btc.value)
			? new CoinAmount(250, Coin.sats)
			: undefined
	);
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

{#snippet percentArrow(percent: number)}
	<span class={{ up: percent >= 0, down: percent < 0 }}>
		{#if percent >= 0}
			<ArrowUpRight size="16" />
		{:else}
			<ArrowDownRight size="16" />
		{/if}
		{percent.toFixed(2)}
	</span>
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
	<div class="amount-row">
		<span class="spacer"></span>
		<div class="amount-input">
			<AmountInput
				bind:amount={inputAmount}
				coin={shownCoin}
				network={$SendTxDetails.toNetwork}
				styleType="big"
				{minAmount}
			/>
		</div>
		<span class="cycle-button">
			<PillButton onclick={cycleShown} styleType="icon">
				<ArrowRightLeft />
			</PillButton>
		</span>
	</div>
	{#if possibleCoins.length > 1}
		<div class="exchange-rates">
			<div class="sm-caption">
				{#if $SendTxDetails.fromCoin}
					{new CoinAmount(1, $SendTxDetails.fromCoin.coin).toPrettyMinFigs()}
					<EqualApproximately size={16} />
					{fromInUsd}
					{#if $SendTxDetails.toCoin}
						<EqualApproximately size={16} />
						{fromInTo}
					{/if}
				{:else if $SendTxDetails.toCoin}
					{new CoinAmount(1, $SendTxDetails.toCoin.coin).toPrettyMinFigs()}
					<EqualApproximately size={16} />
					{toInUsd}
				{/if}
			</div>
		</div>
	{/if}
</div>
<div class="graphs">
	<div style="grid-area: from">
		{#if $SendTxDetails.fromCoin}
			{@const coin = $SendTxDetails.fromCoin.coin}

			<Card>
				<div class="lc-wrapper">
					<div class="lc-labels">
						<div class="coin">
							<img src={coin.icon} alt={coin.label} />
							<div class="label-network">
								{coin.label}
								<span class="sm-caption">Native</span>
							</div>
						</div>
						<div class="amount-percent">
							{#if hoveredFromPoint}
								<p>
									{new CoinAmount(hoveredFromPoint.value, Coin.usd).toPrettyString()}
								</p>
								<p>{moment(hoveredFromPoint.date).format('MMM DD, HH:mm')}</p>
							{:else}
								{fromInUsd}
								{@render percentArrow(getPercentChange(fromData?.quotes))}
							{/if}
						</div>
					</div>
					<LineChart
						data={fromData?.quotes ?? []}
						height={150}
						isLoading={!graphsLoaded.has(coin.value)}
						styleType="trend"
						bind:hoveredPoint={hoveredFromPoint}
					/>
				</div>
			</Card>
		{/if}
	</div>

	<div style="grid-area: to">
		{#if $SendTxDetails.toCoin}
			{@const coin = $SendTxDetails.toCoin.coin}
			<Card>
				<div class="lc-wrapper">
					<div class="lc-labels">
						<div class="coin">
							<img src={coin.icon} alt={coin.label} />
							<div class="label-network">
								{coin.label}
								<span class="sm-caption">Native</span>
							</div>
						</div>
						<div class="amount-percent">
							{#if hoveredToPoint}
								<p>
									{new CoinAmount(hoveredToPoint.value, Coin.usd).toPrettyString()}
								</p>
								<p>{moment(hoveredToPoint.date).format('MMM DD, HH:mm')}</p>
							{:else}
								{toInUsd}
								{@render percentArrow(getPercentChange(toData?.quotes))}
							{/if}
						</div>
					</div>
					<LineChart
						data={toData?.quotes ?? []}
						height={150}
						isLoading={!graphsLoaded.has(coin.value)}
						styleType="trend"
						bind:hoveredPoint={hoveredToPoint}
					/>
				</div>
			</Card>
		{/if}
	</div>
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
	.amount-row {
		margin-top: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		.spacer {
			width: 2.5rem;
		}
	}
	.exchange-rates {
		display: flex;
		justify-content: space-around;
		width: 100%;
		margin-top: 0.5rem;
		div {
			display: flex;
			align-items: center;
			width: fit-content;
		}
	}
	.graphs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto;
		grid-template-areas: 'from to';
		gap: 1rem;
		margin-top: 1.5rem;
		.lc-wrapper {
			height: 100%;
			box-sizing: border-box;
			margin: -0.5rem;
			.lc-labels {
				padding: 0.5rem;
				display: flex;
				justify-content: space-between;
				.coin {
					display: inline-flex;
					align-items: center;
					gap: 0.5rem;
					img {
						width: 2rem;
						height: 2rem;
					}
					.label-network {
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
					}
				}
				.amount-percent {
					display: flex;
					flex-direction: column;
					align-items: flex-end;
					gap: 0.25rem;
				}
			}
		}
		.up,
		.down {
			display: inline-flex;
			align-items: center;
			font-family: 'Noto Sans Mono Variable', monospace;
			width: fit-content;
		}
		.up {
			color: var(--green-fg);
		}
		.down {
			color: var(--secondary-fg-mid);
		}
	}
</style>
