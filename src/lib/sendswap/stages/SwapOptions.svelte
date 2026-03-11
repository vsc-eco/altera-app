<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import {
		getFee,
		getTxSessionId,
		optionsEqual,
		SendTxDetails,
		solveNetworkConstraints
	} from '$lib/sendswap/utils/sendUtils';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
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
		ArrowLeft,
		ArrowUpDown,
		ArrowUpRight,
		ChevronDown,
		ChevronUp,
		Search,
		X
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
	import { accountBalance } from '$lib/stores/currentBalance';
	import type { AccountBalance } from '$lib/stores/currentBalance';
	import { numberFormatLanguage } from '$lib/constants';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import {
		fetchPoolDepths,
		calculateSwap,
		getOrderedDepths,
		type PoolDepths,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';

	let {
		editStage,
		isActive = true
	}: {
		editStage: (complete: boolean) => void;
		isActive?: boolean;
	} = $props();

	onMount(() => {
		loadHistoricalCoinData();
		fetchPoolDepths().then((d) => {
			if (d) poolDepths = d;
		});
	});
	onDestroy(() => {
		saveHistoricalCoinData();
	});

	// Pool depths and swap calculation state
	let poolDepths: PoolDepths | null = $state(null);
	let swapResult: SwapCalcResult | null = $state(null);
	let slippageBps = $state(100); // default 1%
	const slippageOptions = [50, 100, 200, 300]; // 0.5%, 1%, 2%, 3%

	// Recalculate swap whenever input amount, coins, or slippage changes.
	$effect(() => {
		const fromCoin = $SendTxDetails.fromCoin;
		const toCoin = $SendTxDetails.toCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!poolDepths || !fromCoin || !toCoin || !fromAmount || fromAmount === '0') {
			swapResult = null;
			return;
		}

		const isHiveSwap =
			(fromCoin.coin.value === Coin.hive.value || fromCoin.coin.value === Coin.hbd.value) &&
			(toCoin.coin.value === Coin.hive.value || toCoin.coin.value === Coin.hbd.value) &&
			fromCoin.coin.value !== toCoin.coin.value;
		if (!isHiveSwap) {
			swapResult = null;
			return;
		}

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) {
			swapResult = null;
			return;
		}

		const assetIn = fromCoin.coin.value as 'hive' | 'hbd';
		const { X, Y } = getOrderedDepths(poolDepths, assetIn);
		const x = BigInt(fromAmountInt);
		const result = calculateSwap(x, X, Y, slippageBps);
		swapResult = result;

		untrack(() => {
			const expectedOutput = result.expectedOutput.toString();
			const minAmountOut = result.minAmountOut.toString();
			const swapBaseFee = result.baseFee.toString();
			const swapClpFee = result.clpFee.toString();
			const swapTotalFee = result.totalFee.toString();
			if ($SendTxDetails.expectedOutput !== expectedOutput) {
				$SendTxDetails.expectedOutput = expectedOutput;
			}
			if ($SendTxDetails.slippageBps !== slippageBps) {
				$SendTxDetails.slippageBps = slippageBps;
			}
			if ($SendTxDetails.minAmountOut !== minAmountOut) {
				$SendTxDetails.minAmountOut = minAmountOut;
			}
			if ($SendTxDetails.swapBaseFee !== swapBaseFee) {
				$SendTxDetails.swapBaseFee = swapBaseFee;
			}
			if ($SendTxDetails.swapClpFee !== swapClpFee) {
				$SendTxDetails.swapClpFee = swapClpFee;
			}
			if ($SendTxDetails.swapTotalFee !== swapTotalFee) {
				$SendTxDetails.swapTotalFee = swapTotalFee;
			}

			const outputAmt = new CoinAmount(Number(result.expectedOutput), toCoin.coin, true);
			const outputStr = outputAmt.toAmountString();
			if ($SendTxDetails.toAmount !== outputStr) {
				$SendTxDetails.toAmount = outputStr;
			}
		});
	});

	function formatSmallUnits(raw: bigint, decimalPlaces: number): string {
		const n = Number(raw) / 10 ** decimalPlaces;
		return n.toLocaleString(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: decimalPlaces,
			maximumFractionDigits: decimalPlaces
		});
	}

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
			if (isActive) editStage(true);
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
			if (isActive) editStage(false);
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
			const hiveOption = assetOptions.find(
				(opt) => opt.coin.value === Coin.hive.value && !opt.disabled
			);
			const firstAvailable = assetOptions.find((opt) => !opt.disabled);
			const fromOpt = hiveOption ?? firstAvailable;
			const fromNet = fromOpt
				? Array.isArray(fromOpt.networks)
					? fromOpt.networks[0]
					: undefined
				: undefined;
			if (fromOpt)
				SendTxDetails.update((d) => ({
					...d,
					fromCoin: fromOpt,
					fromNetwork: fromNet
				}));
		}

		// TO auto selection, update only if value changes!
		const visibleToObjs = toAssetObjs.filter((obj) => {
			const coinValue = obj.value as keyof AccountBalance;
			if (!coinValue) return false;
			const bal = $accountBalance.bal?.[coinValue];
			return !!bal && Number(bal) > 0.001;
		});
		if (!($SendTxDetails.toCoin && $SendTxDetails.toNetwork)) {
			let nextToCoin: (typeof swapOptions.to.coins)[number] | undefined;
			let nextToNetwork: Network | undefined;
			if (visibleToObjs.length > 0) {
				const hiveTo = visibleToObjs.find((obj) => obj.value === Coin.hive.value);
				const firstAvailableTo = visibleToObjs[0];
				if (hiveTo) {
					const swapTo = swapOptions.to.coins.find((opt) => opt.coin.value === Coin.hive.value);
					if (swapTo) {
						nextToCoin = swapTo;
						nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
					}
				} else if (firstAvailableTo) {
					const swapTo = swapOptions.to.coins.find(
						(opt) => opt.coin.value === firstAvailableTo.value
					);
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
				prevToCoin?.coin.value !== nextToCoin?.coin.value ||
				prevToNetwork?.value !== nextToNetwork?.value;
			if (changed)
				SendTxDetails.update((d) => ({
					...d,
					toCoin: nextToCoin,
					toNetwork: nextToNetwork
				}));
		}
	});

	// Keep TO side as the opposite Hive asset:
	// - From HIVE/TESTS -> To HBD/TBD
	// - From HBD/TBD -> To HIVE/TESTS
	$effect(() => {
		const fromOpt = $SendTxDetails.fromCoin;
		const fromNet = $SendTxDetails.fromNetwork;
		if (!fromOpt || !fromNet) return;

		let targetValue: string | undefined;
		if (fromOpt.coin.value === Coin.hive.value) {
			targetValue = Coin.hbd.value;
		} else if (fromOpt.coin.value === Coin.hbd.value) {
			targetValue = Coin.hive.value;
		} else {
			return;
		}

		const currentTo = $SendTxDetails.toCoin;
		if (currentTo?.coin.value === targetValue) return;

		const targetOpt = swapOptions.to.coins.find((opt) => opt.coin.value === targetValue);
		if (!targetOpt) return;

		let targetNet: Network | undefined = undefined;
		if (fromNet && targetOpt.networks.some((n) => n.value === fromNet.value)) {
			targetNet = fromNet;
		} else if (Array.isArray(targetOpt.networks)) {
			targetNet = targetOpt.networks[0];
		}

		SendTxDetails.update((d) => ({
			...d,
			toCoin: targetOpt,
			toNetwork: targetNet
		}));
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
		},
		{
			...Coin.hive,
			snippet: assetCard,
			snippetData: {
				fromOpt: { coin: Coin.hive, networks: [Network.magi] },
				net: Network.magi,
				size: 'medium'
			}
		},
		{
			...Coin.hbd,
			snippet: assetCard,
			snippetData: {
				fromOpt: { coin: Coin.hbd, networks: [Network.magi] },
				net: Network.magi,
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
	// Only the from coin for the amount input – no dropdown; from is changed only via the left card.
	let amountInputCoinOpts: CoinOnNetwork[] = $derived(
		$SendTxDetails.fromCoin && $SendTxDetails.fromNetwork
			? [{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork }]
			: []
	);

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
		// When pool-based swap calc is active, it sets toAmount directly
		if (swapResult && swapResult.expectedOutput > 0n) return;
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
			return value.toLocaleString(numberFormatLanguage, {
				useGrouping: true,
				maximumFractionDigits: 2,
				minimumFractionDigits: 2
			});
		} else {
			return value.toLocaleString(numberFormatLanguage, {
				useGrouping: true,
				maximumFractionDigits: 4,
				minimumFractionDigits: 2
			});
		}
	}

	let minAmount: CoinAmount<Coin> | undefined = $state();
	$effect(() => {
		const amt =
			$SendTxDetails.fromCoin?.coin.value === Coin.btc.value
				? new CoinAmount(0.0000025, Coin.btc)
				: undefined;
		untrack(() => {
			if (minAmount?.coin.value !== amt?.coin.value || minAmount?.toNumber() !== amt?.toNumber()) {
				minAmount = amt;
			}
		});
	});

	// Max = Magi balance when from is hive/hbd so user can tap Max
	const maxAmount: CoinAmount<Coin> | undefined = $derived.by(() => {
		const from = $SendTxDetails.fromCoin;
		if (!from || $SendTxDetails.fromNetwork?.value !== Network.magi.value) return undefined;
		const key = from.coin.value as keyof AccountBalance;
		const bal = $accountBalance.bal?.[key];
		if (bal == null || typeof bal !== 'number' || bal <= 0) return undefined;
		return new CoinAmount(bal, from.coin, true);
	});

	let feesExpanded = $state(false);

	let dialogOpen = $state(false);
	let toggle = $state<(open?: boolean) => void>(() => {});
	let currentlyOpen: 'from' | 'to' = $state('from');

	// ── Multi-step dialog state ──
	let dialogStep: 'tokens' | 'source' = $state('tokens');
	let tempCoinOpt: CoinOptions['coins'][number] | undefined = $state();
	let tokenSearch = $state('');

	function openDialog(state: 'from' | 'to') {
		// To is fixed when from is Hive/HBD (TESTS↔TBD); do not open To picker
		if (
			state === 'to' &&
			($SendTxDetails.fromCoin?.coin.value === Coin.hive.value ||
				$SendTxDetails.fromCoin?.coin.value === Coin.hbd.value)
		)
			return;
		currentlyOpen = state;
		dialogStep = 'tokens';
		tokenSearch = '';
		tempCoinOpt = undefined;
		toggle(true);
	}

	function closeDialog() {
		toggle(false);
		dialogStep = 'tokens';
		tokenSearch = '';
		tempCoinOpt = undefined;
	}

	function getFilteredTokens(tokens: AssetObject[]): AssetObject[] {
		if (!tokenSearch.trim()) return tokens;
		const s = tokenSearch.toLowerCase().trim();
		return tokens.filter(
			(t) => t.label.toLowerCase().includes(s) || t.value.toLowerCase().includes(s)
		);
	}

	function getNetworkBalance(coinValue: string, networkValue: string): string {
		const coinDef = Object.values(Coin).find((c) => c.value === coinValue);
		if (networkValue === Network.magi.value) {
			const bal = $accountBalance.bal?.[coinValue as keyof AccountBalance];
			if (bal != null && typeof bal === 'number' && bal > 0) {
				return new CoinAmount(bal, coinDef ?? Coin.unk, true).toPrettyAmountString();
			}
		} else if ($accountBalance.connectedBal) {
			const bal =
				$accountBalance.connectedBal[coinValue as keyof typeof $accountBalance.connectedBal];
			if (bal != null && typeof bal === 'number' && bal > 0) {
				return new CoinAmount(bal, coinDef ?? Coin.unk, true).toPrettyAmountString();
			}
		}
		return '0';
	}

	function getNetworkDescription(networkValue: string): string {
		if (networkValue === Network.magi.value) return 'Magi Network balance';
		if (networkValue === Network.hiveMainnet.value) return 'Connected wallet';
		if (networkValue === Network.lightning.value) return 'Connected wallet';
		return 'External network';
	}

	function selectToken(token: AssetObject) {
		const source = currentlyOpen === 'from' ? swapOptions.from.coins : swapOptions.to.coins;
		const coinOpt = source.find((opt) => opt.coin.value === token.value);
		if (!coinOpt) return;
		tempCoinOpt = coinOpt;

		if (currentlyOpen === 'from') {
			if (coinOpt.networks.length <= 1) {
				confirmFromSelection(coinOpt, coinOpt.networks[0] ?? Network.magi);
			} else {
				dialogStep = 'source';
			}
		} else {
			// To selection: pick the first network (destination is chosen in the next step)
			confirmToSelection(coinOpt, coinOpt.networks[0] ?? Network.magi);
		}
	}

	function confirmFromSelection(coinOpt: CoinOptions['coins'][number], network: Network) {
		SendTxDetails.update((d) => ({ ...d, fromCoin: coinOpt, fromNetwork: network }));
		closeDialog();
	}

	function confirmToSelection(coinOpt: CoinOptions['coins'][number], network: Network) {
		SendTxDetails.update((d) => ({ ...d, toCoin: coinOpt, toNetwork: network }));
		closeDialog();
	}

	function coinDisplayLabel(coin: (typeof Coin)[keyof typeof Coin]): string {
		return coin.value === Coin.hive.value
			? getHiveAssetName()
			: coin.value === Coin.hbd.value
				? getHbdAssetName()
				: coin.label;
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
		{#if dialogStep === 'tokens'}
			<!-- Step 1: Token Chip Grid -->
			<div class="dialog-content">
				<div class="dialog-title-row">
					<h5>{currentlyOpen === 'from' ? "You're sending..." : "You're receiving..."}</h5>
					<button class="dialog-close-btn" onclick={closeDialog}><X size={20} /></button>
				</div>
				<div class="token-search-wrapper">
					<Search size={16} />
					<input bind:value={tokenSearch} placeholder="Search token..." />
				</div>
				<div class="token-chip-grid">
					{#each getFilteredTokens(currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs) as token (token.value)}
						<button class="token-chip" onclick={() => selectToken(token)}>
							<img src={token.icon} alt={token.label} class="chip-icon" />
							<span>{coinDisplayLabel(token)}</span>
						</button>
					{/each}
				</div>
			</div>
		{:else if dialogStep === 'source' && tempCoinOpt}
			<!-- Step 2 (From): Where is your TOKEN? -->
			<div class="dialog-content">
				<div class="dialog-title-row">
					<button class="dialog-back-btn" onclick={() => { dialogStep = 'tokens'; tempCoinOpt = undefined; }}>
						<ArrowLeft size={18} /> Back
					</button>
					<img src={tempCoinOpt.coin.icon} alt="" class="dialog-title-icon" />
					<h5>Where is your {coinDisplayLabel(tempCoinOpt.coin)}?</h5>
					<button class="dialog-close-btn" onclick={closeDialog}><X size={20} /></button>
				</div>
				<div class="network-cards">
					{#each tempCoinOpt.networks as net (net.value)}
						<button class="network-card" onclick={() => confirmFromSelection(tempCoinOpt!, net)}>
							<img src={tempCoinOpt.coin.icon} alt="" class="network-card-icon" />
							<div class="network-card-info">
								<span class="network-card-name">{coinDisplayLabel(tempCoinOpt.coin)} on {net.label}</span>
								<span class="network-card-desc sm-caption">{getNetworkDescription(net.value)}</span>
							</div>
							<div class="network-card-balance">
								<span class="balance-amount">{getNetworkBalance(tempCoinOpt.coin.value, net.value)}</span>
								<span class="balance-label sm-caption">available</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/snippet}
</Dialog>

<div class="quick-swap-card">
	<h2 class="swap-title">Quick swap</h2>

	<!-- From Section -->
	<div class="swap-section">
		<div class="section-header">
			<span class="section-label">From</span>
			<span class="section-info sm-caption">
				{#if $SendTxDetails.fromCoin}
					From {$SendTxDetails.fromCoin.networks.length} network{$SendTxDetails.fromCoin.networks.length !== 1 ? 's' : ''}
					{#if $SendTxDetails.fromNetwork}
						&middot; On {$SendTxDetails.fromNetwork.label}
					{/if}
				{/if}
			</span>
		</div>
		<div class="section-input-row">
			<div class="input-field">
				<AmountInput bind:coinAmount={inputAmount} coinOpts={amountInputCoinOpts} {minAmount} maxAmount={maxAmount} />
			</div>
			<button class="token-selector-btn" onclick={() => openDialog('from')}>
				{#if $SendTxDetails.fromCoin}
					<img src={$SendTxDetails.fromCoin.coin.icon} alt={coinDisplayLabel($SendTxDetails.fromCoin.coin)} class="token-icon" />
					<span class="token-name">{coinDisplayLabel($SendTxDetails.fromCoin.coin)}</span>
				{:else}
					<span class="token-name">Select</span>
				{/if}
				<ChevronDown size={14} />
			</button>
		</div>
	</div>

	<!-- Swap Toggle -->
	<div class="swap-toggle-wrapper">
		<button class="swap-toggle-btn" aria-label="Swap direction">
			<ArrowUpDown size={18} />
		</button>
	</div>

	<!-- To Section -->
	<div class="swap-section">
		<div class="section-header">
			<span class="section-label">To</span>
			<span class="section-info sm-caption">
				{#if $SendTxDetails.toNetwork}
					{$SendTxDetails.toNetwork.label}
				{:else}
					Select destination
				{/if}
			</span>
		</div>
		<div class="section-input-row">
			<div class="to-amount-display">
				{#if $SendTxDetails.toAmount && $SendTxDetails.toAmount !== '0'}
					<span class="to-amount-value">{$SendTxDetails.toAmount}</span>
				{:else}
					<span class="to-amount-placeholder">&mdash;</span>
				{/if}
			</div>
			{#if $SendTxDetails.fromCoin?.coin.value === Coin.hive.value || $SendTxDetails.fromCoin?.coin.value === Coin.hbd.value}
				<!-- To is fixed (TESTS↔TBD); show token but not clickable -->
				<div class="token-selector-btn fixed">
					{#if $SendTxDetails.toCoin}
						<img src={$SendTxDetails.toCoin.coin.icon} alt={coinDisplayLabel($SendTxDetails.toCoin.coin)} class="token-icon" />
						<span class="token-name">{coinDisplayLabel($SendTxDetails.toCoin.coin)}</span>
					{:else}
						<span class="token-name">Select</span>
					{/if}
				</div>
			{:else}
				<button class="token-selector-btn" onclick={() => openDialog('to')}>
					{#if $SendTxDetails.toCoin}
						<img src={$SendTxDetails.toCoin.coin.icon} alt={coinDisplayLabel($SendTxDetails.toCoin.coin)} class="token-icon" />
						<span class="token-name">{coinDisplayLabel($SendTxDetails.toCoin.coin)}</span>
					{:else}
						<span class="token-name">Select</span>
					{/if}
					<ChevronDown size={14} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Exchange Rate -->
	{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
		<div class="exchange-rate-row">
			{new CoinAmount(1, $SendTxDetails.fromCoin.coin).toPrettyMinFigs()}
			= {fromInTo}
		</div>
	{/if}

	<!-- Fees Section (collapsible) -->
	{#if swapResult && $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
		{@const fromDec = $SendTxDetails.fromCoin.coin.decimalPlaces}
		{@const toDec = $SendTxDetails.toCoin.coin.decimalPlaces}
		{@const fromUnit = coinDisplayLabel($SendTxDetails.fromCoin.coin)}
		{@const toUnit = coinDisplayLabel($SendTxDetails.toCoin.coin)}
		<div class="swap-fees">
			<!-- Always visible: slippage + toggle header -->
			<div class="fees-header">
				<span class="fee-label">Slippage Tolerance</span>
				<div class="fees-header-right">
					<div class="slippage-options">
						{#each slippageOptions as bps}
							<button
								class={{ active: slippageBps === bps }}
								onclick={() => { slippageBps = bps; }}
							>
								{(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
							</button>
						{/each}
					</div>
					<button class="fees-toggle-btn" onclick={() => { feesExpanded = !feesExpanded; }} aria-label="Toggle fee details">
						{#if feesExpanded}
							<ChevronUp size={16} />
						{:else}
							<ChevronDown size={16} />
						{/if}
					</button>
				</div>
			</div>

			<!-- Expandable fee details -->
			{#if feesExpanded}
				<div class="fee-details">
					<div class="fee-row">
						<span class="fee-label">Expected Output</span>
						<span class="fee-value">{formatSmallUnits(swapResult.expectedOutput, toDec)} {toUnit}</span>
					</div>
					<div class="fee-row">
						<span class="fee-label">Base Fee (0.08%)</span>
						<span class="fee-value">{formatSmallUnits(swapResult.baseFee, fromDec)} {fromUnit}</span>
					</div>
					<div class="fee-row">
						<span class="fee-label">CLP Fee</span>
						<span class="fee-value">{formatSmallUnits(swapResult.clpFee, fromDec)} {fromUnit}</span>
					</div>
					<div class="fee-row highlight">
						<span class="fee-label">Total Fee</span>
						<span class="fee-value">{formatSmallUnits(swapResult.totalFee, fromDec)} {fromUnit}</span>
					</div>
					<div class="fee-row">
						<span class="fee-label">Min. Amount Out</span>
						<span class="fee-value">{formatSmallUnits(swapResult.minAmountOut, toDec)} {toUnit}</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Charts Section (below the card) -->
<div class={['graphs', { hide: !$SendTxDetails.fromCoin && !$SendTxDetails.toCoin }]}>
	<div style="grid-area: from">
		{#if $SendTxDetails.fromCoin}
			{@const coin = $SendTxDetails.fromCoin.coin}
			<Card>
				<div class="lc-wrapper">
					<div class="lc-labels">
						<div class="coin">
							<img src={coin.icon} alt={coinDisplayLabel(coin)} />
							<div class="label-network">
								{coinDisplayLabel(coin)}
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
							<img src={coin.icon} alt={coinDisplayLabel(coin)} />
							<div class="label-network">
								{coinDisplayLabel(coin)}
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
	/* ── Quick Swap Card ── */
	.quick-swap-card {
		background-color: var(--swap-card-bg);
		border: 1px solid var(--swap-card-border);
		border-radius: 0.75rem;
		padding: 1.25rem;
		margin: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0;
		box-shadow: 0 0 4px oklch(from var(--dark-purple) l c h / 0.1);
	}
	.swap-title {
		font-size: var(--text-2xl);
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--neutral-fg);
	}

	/* ── Swap Section (From / To) ── */
	.swap-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.section-label {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
		font-weight: 500;
	}
	.section-info {
		font-size: var(--text-xs);
	}
	.section-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: var(--swap-section-bg);
		border: 1px solid var(--swap-input-border);
		border-radius: 0.5rem;
		padding: 0.25rem 0.25rem 0.25rem 0.5rem;
		min-height: 3rem;
	}
	.input-field {
		flex: 1;
		min-width: 0;
	}
	.input-field :global(.normal-wrapper label) {
		display: none;
	}
	.input-field :global(.normal-wrapper .amount-input) {
		border: none;
	}
	.input-field :global(.normal-wrapper .amount-input:has(input:focus-visible)) {
		box-shadow: none;
		border-bottom-color: transparent;
		border-radius: 0;
	}
	.input-field :global(.normal-wrapper .bottom-info) {
		position: static;
		padding-top: 0;
	}
	.to-amount-display {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0;
		font-size: var(--text-2xl);
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
	}
	.to-amount-value {
		color: var(--neutral-fg);
	}
	.to-amount-placeholder {
		color: var(--neutral-fg-mid);
		font-size: var(--text-3xl);
	}

	/* ── Token Selector Button ── */
	.token-selector-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background-color: var(--swap-token-btn-bg);
		border: 1px solid var(--swap-token-btn-border);
		border-radius: 2rem;
		cursor: pointer;
		color: var(--neutral-fg);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		white-space: nowrap;
		transition: background-color 0.15s ease;
		&:hover {
			background-color: var(--neutral-bg-accent-shifted);
		}
		&.fixed {
			cursor: default;
			&:hover {
				background-color: var(--swap-token-btn-bg);
			}
		}
		.token-icon {
			width: 1.25rem;
			height: 1.25rem;
			border-radius: 50%;
		}
		.token-name {
			font-weight: 500;
		}
	}

	/* ── Swap Toggle ── */
	.swap-toggle-wrapper {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0;
	}
	.swap-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid var(--swap-card-border);
		background-color: var(--swap-toggle-bg);
		color: var(--neutral-fg-mid);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
		&:hover {
			background-color: var(--neutral-bg-accent-shifted);
			color: var(--neutral-fg);
		}
	}

	/* ── Exchange Rate ── */
	.exchange-rate-row {
		text-align: center;
		padding: 0.75rem 0 0.25rem;
		font-size: var(--text-sm);
		color: var(--swap-rate-color);
	}

	/* ── Fees Section (collapsible) ── */
	.swap-fees {
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--swap-fee-border);
		border-radius: 0.5rem;
		background-color: var(--swap-fee-bg);
		overflow: hidden;
	}
	.fees-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
	}
	.fees-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.fees-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--neutral-fg-mid);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: color 0.15s ease, background-color 0.15s ease;
		&:hover {
			color: var(--neutral-fg);
			background-color: var(--swap-toggle-bg);
		}
	}
	.fee-details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 0.75rem 0.75rem;
		border-top: 1px solid var(--swap-fee-border);
		padding-top: 0.625rem;
	}
	.fee-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.125rem 0;
		&.highlight {
			padding-top: 0.375rem;
			margin-top: 0.125rem;
			border-top: 1px solid var(--swap-fee-border);
			font-weight: 500;
		}
	}
	.fee-label {
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
	}
	.fee-value {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		font-size: var(--text-sm);
	}
	.slippage-options {
		display: flex;
		gap: 0.25rem;
		button {
			padding: 0.25rem 0.5rem;
			border: 1px solid var(--swap-fee-border);
			border-radius: 0.5rem;
			background: transparent;
			color: var(--neutral-fg);
			cursor: pointer;
			font-size: var(--text-xs);
			font-weight: 500;
			transition: background-color 0.15s ease, border-color 0.15s ease;
			&.active {
				background-color: var(--primary-bg);
				color: var(--primary-fg);
				border-color: var(--primary-bg);
			}
			&:hover:not(.active) {
				background-color: var(--neutral-bg-accent-shifted);
			}
		}
	}

	/* ── Charts Section ── */
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

	/* ── Dialog: Token Grid ── */
	.dialog-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		h5 {
			flex: 1;
			margin: 0;
			font-size: var(--text-3xl);
			font-weight: 600;
			color: var(--neutral-fg);
		}
	}
	.dialog-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--neutral-fg-mid);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 50%;
		transition: color 0.15s ease;
		&:hover {
			color: var(--neutral-fg);
		}
	}
	.dialog-back-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		color: var(--neutral-fg-mid);
		cursor: pointer;
		font: inherit;
		font-size: var(--text-sm);
		padding: 0.25rem 0.5rem 0.25rem 0;
		transition: color 0.15s ease;
		&:hover {
			color: var(--neutral-fg);
		}
	}
	.dialog-title-icon {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}
	.token-search-wrapper {
		position: relative;
		margin-bottom: 1rem;
		:global(svg) {
			position: absolute;
			left: 0.75rem;
			top: 50%;
			transform: translateY(-50%);
			color: var(--neutral-fg-mid);
			pointer-events: none;
		}
		input {
			width: 100%;
			box-sizing: border-box;
			padding: 0.625rem 0.75rem 0.625rem 2.25rem;
			border: 1px solid var(--swap-input-border);
			border-radius: 0.5rem;
			background-color: var(--swap-section-bg);
			color: var(--neutral-fg);
			font: inherit;
			font-size: var(--text-sm);
			&::placeholder {
				color: var(--neutral-fg-mid);
			}
		}
	}
	.token-chip-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.token-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--swap-token-btn-border);
		border-radius: 2rem;
		background-color: var(--swap-token-btn-bg);
		color: var(--neutral-fg);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
		&:hover {
			background-color: var(--neutral-bg-accent-shifted);
			border-color: var(--neutral-bg-accent-shifted);
		}
		.chip-icon {
			width: 1.25rem;
			height: 1.25rem;
			border-radius: 50%;
		}
	}

	/* ── Dialog: Network Cards (Source) ── */
	.network-cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.network-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--swap-card-border);
		border-radius: 0.75rem;
		background-color: var(--swap-section-bg);
		cursor: pointer;
		color: var(--neutral-fg);
		font: inherit;
		text-align: left;
		transition: border-color 0.15s ease, background-color 0.15s ease;
		&:hover {
			border-color: var(--primary-bg);
			background-color: var(--swap-card-bg);
		}
		.network-card-icon {
			width: 2.25rem;
			height: 2.25rem;
			border-radius: 50%;
			flex-shrink: 0;
		}
		.network-card-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}
		.network-card-name {
			font-weight: 500;
		}
		.network-card-balance {
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 0.125rem;
			flex-shrink: 0;
		}
		.balance-amount {
			font-family: 'Noto Sans Mono Variable', monospace;
			font-weight: 400;
		}
	}

	/* ── Responsive ── */
	@media screen and (max-width: 450px) {
		.quick-swap-card {
			padding: 1rem;
		}
		.graphs {
			display: flex;
			flex-direction: column;
		}
	}
</style>
