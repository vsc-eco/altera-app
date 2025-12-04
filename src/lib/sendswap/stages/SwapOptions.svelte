<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import {
		getFee,
		getTxSessionId,
		optionsEqual,
		SendTxDetails,
		solveNetworkConstraints
	} from '$lib/sendswap/utils/sendUtils';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import AssetInfo from '$lib/sendswap/components/info/AssetInfo.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '$lib/sendswap/utils/sendOptions';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import {
		ArrowDownRight,
		ArrowRightLeft,
		ArrowUpRight,
		EqualApproximately,
		Shuffle
	} from '@lucide/svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import {
		updateHistoricalData,
		HistoricalCoinData,
		type CoinMarketMapData,
		loadHistoricalCoinData,
		saveHistoricalCoinData
	} from '$lib/currency/historical';
	import LineChart, { type Point } from '$lib/LineChart.svelte';
	import Card from '$lib/cards/Card.svelte';
	import moment from 'moment';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectAssetFlattened from '../components/assetSelection/SelectAssetFlattened.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import type { AccountBalance } from '$lib/stores/currentBalance';

	let {
		editStage
	}: {
		editStage: (complete: boolean) => void;
	} = $props();

	onMount(() => {
		loadHistoricalCoinData();
	});
	onDestroy(() => {
		saveHistoricalCoinData();
	});

	const auth = $derived(getAuth()());

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
			editStage(true);
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
			editStage(false);
		}
	});

	let { assetOptions, networkOptions } = $state<ReturnType<typeof solveNetworkConstraints>>({
		assetOptions: [],
		networkOptions: []
	});
	$effect(() => {
		const { assetOptions: newAssetOptions, networkOptions: newNetworkOptions } =
			solveNetworkConstraints(
				$SendTxDetails.method,
				$SendTxDetails.fromCoin,
				$SendTxDetails.toNetwork,
				auth.value?.did,
				$SendTxDetails.fromNetwork,
				true
			);
		if (!optionsEqual(newAssetOptions, assetOptions)) {
			assetOptions = newAssetOptions;
		}
		if (!optionsEqual(newNetworkOptions, networkOptions)) {
			networkOptions = newNetworkOptions;
		}
	});

	$effect(() => {
		// FROM auto selection
		if (!($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork) && assetOptions.length > 0) {
			const hiveOption = assetOptions.find(opt => opt.coin.value === Coin.hive.value && !opt.disabled);
			const firstAvailable = assetOptions.find(opt => !opt.disabled);
			if (hiveOption) {
				$SendTxDetails.fromCoin = hiveOption;
				$SendTxDetails.fromNetwork = Array.isArray(hiveOption.networks) ? hiveOption.networks[0] : undefined;
			} else if (firstAvailable) {
				$SendTxDetails.fromCoin = firstAvailable;
				$SendTxDetails.fromNetwork = Array.isArray(firstAvailable.networks) ? firstAvailable.networks[0] : undefined;
			}
		}

		// TO auto selection, update only if value changes!
		const visibleToObjs = toAssetObjs.filter(obj => {
			const coinValue = obj.value as keyof AccountBalance;
			if (!coinValue) return false;
			const bal = $accountBalance.bal?.[coinValue];
			return !!bal && Number(bal) > 0.001;
		});
		if (!($SendTxDetails.toCoin && $SendTxDetails.toNetwork)) {
			let nextToCoin, nextToNetwork;
			if (visibleToObjs.length > 0) {
				const hiveTo = visibleToObjs.find(obj => obj.value === Coin.hive.value);
				const firstAvailableTo = visibleToObjs[0];
				if (hiveTo) {
					const swapTo = swapOptions.to.coins.find(opt => opt.coin.value === Coin.hive.value);
					if (swapTo) {
						nextToCoin = swapTo;
						nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
					}
				} else if (firstAvailableTo) {
					const swapTo = swapOptions.to.coins.find(opt => opt.coin.value === firstAvailableTo.value);
					if (swapTo) {
						nextToCoin = swapTo;
						nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
					}
				}
			} else {
				nextToCoin = undefined;
				nextToNetwork = undefined;
			}
			const prevToCoin = $SendTxDetails.toCoin;
			const prevToNetwork = $SendTxDetails.toNetwork;
			const changed =
				(prevToCoin !== nextToCoin) ||
				(prevToNetwork !== nextToNetwork);
			if (changed) {
				$SendTxDetails.toCoin = nextToCoin;
				$SendTxDetails.toNetwork = nextToNetwork;
			}
		}
	});

	const fromAssetObjs: AssetObject[] = $derived([
		{
			...Coin.btc,
			snippet: assetCard,
			snippetData: {
				fromOpt: { coin: Coin.btc, networks: [Network.lightning] },
				net: Network.lightning,
				size: 'medium'
			}
		}
	]);
	const toAssetObjs: AssetObject[] = $derived(
		swapOptions.to.coins.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.toNetwork, size: 'medium' }
		}))
	);
	let possibleCoins: CoinOnNetwork[] = $derived.by(() => {
		let result: CoinOnNetwork[] = [];
		if ($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork) {
			result.push({ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork });
		}
		if ($SendTxDetails.toCoin && $SendTxDetails.toNetwork) {
			result.push({ coin: $SendTxDetails.toCoin.coin, network: $SendTxDetails.toNetwork });
		}
		const btcIndex = result.findIndex((coinOnNet) => coinOnNet.coin.value === Coin.btc.value);
		if (btcIndex !== -1) {
			result.splice(btcIndex + 1, 0, { coin: Coin.sats, network: result[btcIndex].network });
		}
		return result;
	});

	let inputAmount = $state(new CoinAmount(0, Coin.unk));
	$effect(() => {
		if (!$SendTxDetails.fromCoin) return;
		if (inputAmount.coin.value === $SendTxDetails.fromCoin.coin.value) {
			const amt = inputAmount.toAmountString();
			if (amt !== $SendTxDetails.fromAmount) $SendTxDetails.fromAmount = amt;
		} else {
			inputAmount.convertTo($SendTxDetails.fromCoin.coin, Network.lightning).then((amt) => {
				if ($SendTxDetails.fromAmount !== amt.toAmountString()) {
					$SendTxDetails.fromAmount = amt.toAmountString();
				}
			});
		}
	});

	$effect(() => {
		if (!$SendTxDetails.toCoin) return;
		if (inputAmount.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = inputAmount.toAmountString();
			if (amt !== $SendTxDetails.toAmount) $SendTxDetails.toAmount = amt;
		} else {
			inputAmount.convertTo($SendTxDetails.toCoin.coin, Network.lightning).then((amt) => {
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

			updateHistoricalData(currentlyDefined)
				.then(() => {
					if ($SendTxDetails.fromCoin && $SendTxDetails.fromCoin.coin.ucid) {
						fromData = $HistoricalCoinData.get($SendTxDetails.fromCoin.coin.ucid);
					}
					if ($SendTxDetails.toCoin && $SendTxDetails.toCoin.coin.ucid) {
						toData = $HistoricalCoinData.get($SendTxDetails.toCoin.coin.ucid);
					}
				})
				.finally(() => (graphsLoaded = graphsLoaded.union(definedSet)));
		});
	});
	function getPercentChange(points: Point[] | undefined, current?: number) {
		if (!points || points.length === 0) return 0;
		const first = points[0].value;
		const last = points[points.length - 1].value;
		return (last / first - 1) * 100;
	}
	function formatGraphValue(value: number) {
		if (value > 10) {
			return value.toLocaleString(navigator.language, {
				useGrouping: true,
				maximumFractionDigits: 2,
				minimumFractionDigits: 2
			});
		} else {
			return value.toLocaleString(navigator.language, {
				useGrouping: true,
				maximumFractionDigits: 4,
				minimumFractionDigits: 2
			});
		}
	}

	let minAmount: CoinAmount<Coin> | undefined = $state();
	$effect(() => {
		const amt = possibleCoins.some((coin) => coin.coin.value === Coin.btc.value)
			? new CoinAmount(0.0000025, Coin.btc)
			: undefined;
		untrack(() => {
			if (minAmount?.coin.value !== amt?.coin.value || minAmount?.toNumber() !== amt?.toNumber()) {
				minAmount = amt;
			}
		});
	});

	let dialogOpen = $state(false);
	let toggle = $state<(open?: boolean) => void>(() => {});
	let currentlyOpen: 'from' | 'to' = $state('from');
	function openDialog(state: 'from' | 'to') {
		currentlyOpen = state;
		toggle(true);
	}
</script>

{#snippet percentArrow(percent: number)}
	<span class={{ up: percent >= 0, down: percent < 0 }}>
		{#if percent >= 0}
			<ArrowUpRight size="16" />
		{:else}
			<ArrowDownRight size="16" />
		{/if}
		{percent.toFixed(2) + '%'}
	</span>
{/snippet}

<Dialog bind:open={dialogOpen} bind:toggle>
	{#snippet content()}
		{#if currentlyOpen === 'from'}
			<SelectAssetFlattened
				availableCoins={fromAssetObjs}
				bind:coin={$SendTxDetails.fromCoin}
				bind:network={$SendTxDetails.fromNetwork}
				close={toggle}
				externalNetwork={Network.lightning}
			/>
		{:else}
			<SelectAssetFlattened
				availableCoins={toAssetObjs}
				close={toggle}
				bind:coin={$SendTxDetails.toCoin}
				bind:network={$SendTxDetails.toNetwork}
			/>
		{/if}
	{/snippet}
</Dialog>

<h2>Swap</h2>
<div class="coin-options">
	<ClickableCard onclick={() => openDialog('from')}>
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
	<ClickableCard onclick={() => openDialog('to')}>
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
		<!-- <span class="spacer"></span> -->
		<div class="amount-input">
			<AmountInput bind:coinAmount={inputAmount} coinOpts={possibleCoins} {minAmount} />
		</div>
	</div>
	<!-- <div class={['enter-prompt', 'sm-caption', { hide: !!inputAmount }]}>Enter Amount</div> -->
</div>
{#if possibleCoins.length > 1}
	<div class="exchange-rates">
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
{/if}
<div class={['graphs', { hide: !$SendTxDetails.fromCoin && !$SendTxDetails.toCoin }]}>
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
									{`${formatGraphValue(hoveredFromPoint.value)} ${Coin.usd.unit}`}
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
									{`${formatGraphValue(hoveredToPoint.value)} ${Coin.usd.unit}`}
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
	// for big input
	.coin-options {
		display: flex;
		gap: 1.5rem;
		.asset-wrapper {
			min-height: 3.5rem;
			padding: 0.5rem;
			display: flex;
			align-items: center;
			text-align: center;
		}
	}
	// .amount {
	// 	&:has(:global(input):focus-visible) {
	// 		.enter-prompt {
	// 			visibility: hidden;
	// 		}
	// 	}
	// }
	// .enter-prompt {
	// 	width: 100%;
	// 	text-align: center;
	// 	padding-top: 0.25rem;
	// 	&.hide {
	// 		visibility: hidden;
	// 	}
	// }
	.amount-row {
		margin-top: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		// .spacer {
		// 	width: 2.5rem;
		// }
		.amount-input {
			flex-grow: 1;
		}
	}
	.exchange-rates {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		width: 100%;
		margin-top: 1.5rem;
		:global(.lucide-equal-approximately) {
			min-width: 16px;
		}
	}
	.graphs {
		&.hide {
			display: none;
		}
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto;
		grid-template-areas: 'from to';
		gap: 1.5rem;
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
			color: var(--quaternary-mid);
		}
		.down {
			color: var(--secondary-fg-mid);
		}
	}
	@media screen and (max-width: 450px) {
		.coin-options {
			flex-wrap: wrap;
		}
		.graphs {
			display: flex;
			flex-direction: column;
		}
	}
</style>
