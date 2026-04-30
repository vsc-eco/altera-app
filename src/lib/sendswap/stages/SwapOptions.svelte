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
	import { onMount, untrack } from 'svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '$lib/sendswap/utils/sendOptions';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ChevronDown, Search, Send, TriangleAlert, Wallet, X } from '@lucide/svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Dialog from '$lib/zag/Dialog.svelte';
	import { accountBalance, getBalanceSmallestUnits } from '$lib/stores/currentBalance';
	import type { AccountBalance } from '$lib/stores/currentBalance';
	import { numberFormatLanguage } from '$lib/constants';
	import { getHiveAssetName, getHbdAssetName, vscNetworkId } from '$lib/../client';
	import {
		fetchTypedPoolDepths,
		getOrderedDepthsFor,
		calculateTwoHopSwap,
		checkExceedsPoolDepth,
		calculatePriceImpact,
		type TypedPoolDepths,
		calculateSwap,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { browser } from '$app/environment';
	import { validate as validateBtcAddr, Network as BtcNetwork } from 'bitcoin-address-validation';
	import { isVscTestnet } from '../../../client';
	import { getAlteraFeePct } from '$lib/magiTransactions/hive/vscOperations/swap';

	let {
		editStage,
		isActive = true,
		status = { message: '', isError: false },
		waiting = false,
		abort = () => {}
	}: {
		editStage: (complete: boolean) => void;
		isActive?: boolean;
		status?: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
	} = $props();

	onMount(() => {
		// Resolve each swap-eligible pool dynamically so calls are
		// network-aware (mainnet vs testnet). Both are loaded in
		// parallel — the swap-calc effect picks whichever it needs
		// based on the user's selected pair.
		(async () => {
			const [hiveHbd, btcHbd] = await Promise.all([
				fetchTypedPoolDepths('HIVE', 'HBD'),
				fetchTypedPoolDepths('BTC', 'HBD')
			]);
			if (hiveHbd) hiveHbdPool = hiveHbd;
			if (btcHbd) btcHbdPool = btcHbd;
		})();
	});

	// Pool depths and swap calculation state
	let hiveHbdPool = $state<TypedPoolDepths | null>(null);
	let btcHbdPool = $state<TypedPoolDepths | null>(null);
	let swapResult: SwapCalcResult | null = $state(null);
	let slippageBps = $state(100); // default 1%
	const slippageOptions = [50, 100, 200, 300]; // 0.5%, 1%, 2%, 3%
	let customSlippageOpen = $state(false);
	let customSlippageInput = $state('');
	let customSlippageInputEl: HTMLInputElement | null = $state(null);

	// Auto-focus the custom input when it opens and pre-select the text.
	$effect(() => {
		if (customSlippageOpen && customSlippageInputEl) {
			customSlippageInputEl.focus();
			customSlippageInputEl.select();
		}
	});

	// Whether the raw custom input is syntactically invalid (for red border).
	let customSlippageInvalid = $derived.by(() => {
		if (!customSlippageInput.trim()) return false;
		const v = parseFloat(customSlippageInput.replace(',', '.'));
		return isNaN(v) || v <= 0 || v > 99.99;
	});

	function applyCustomSlippage() {
		const raw = customSlippageInput.replace(',', '.').trim();
		if (!raw) {
			customSlippageOpen = false;
			return;
		}
		let v = parseFloat(raw);
		if (isNaN(v) || v <= 0) {
			customSlippageOpen = false;
			return;
		}
		v = Math.min(Math.max(v, 0.01), 99.99);
		// Round to at most 2 decimal places and strip trailing zeroes.
		customSlippageInput = parseFloat(v.toFixed(2)).toString();
		slippageBps = Math.round(v * 100);
		// Collapse back to pill — shows as active button with the custom value.
		customSlippageOpen = false;
	}

	// Mirror slippage into the shared store regardless of pair. The
	// calculate-swap effect below only runs for HIVE↔HBD pairs, so for
	// BTC pairs (or any other route that doesn't have live pool math
	// in the frontend yet) this ensures the router still gets the
	// user's chosen tolerance when the tx is built.
	$effect(() => {
		if ($SendTxDetails.slippageBps !== slippageBps) {
			$SendTxDetails.slippageBps = slippageBps;
		}
	});

	// Recalculate swap whenever input amount, coins, or slippage changes.
	$effect(() => {
		const fromCoin = $SendTxDetails.fromCoin;
		const toCoin = $SendTxDetails.toCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!fromCoin || !toCoin || !fromAmount || fromAmount === '0') {
			swapResult = null;
			return;
		}

		const swapAssets = new Set([Coin.hive.value, Coin.hbd.value, Coin.btc.value]);
		const isSwap =
			swapAssets.has(fromCoin.coin.value) &&
			swapAssets.has(toCoin.coin.value) &&
			fromCoin.coin.value !== toCoin.coin.value;
		if (!isSwap) {
			swapResult = null;
			return;
		}

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) {
			swapResult = null;
			return;
		}

		const x = BigInt(fromAmountInt);
		const assetIn = fromCoin.coin.value;
		const assetOut = toCoin.coin.value;
		const involvesBtc = assetIn === Coin.btc.value || assetOut === Coin.btc.value;

		// Pick the right pool(s) for this pair:
		//   HIVE ↔ HBD → hiveHbdPool single hop
		//   BTC  ↔ HBD → btcHbdPool single hop
		//   BTC  ↔ HIVE → btcHbdPool → hiveHbdPool two-hop via HBD
		let result: SwapCalcResult | null = null;

		if (!involvesBtc) {
			if (!hiveHbdPool) {
				swapResult = null;
				return;
			}
			const depths = getOrderedDepthsFor(hiveHbdPool, assetIn);
			if (!depths) {
				swapResult = null;
				return;
			}
			result = calculateSwap(x, depths.X, depths.Y, slippageBps);
		} else if (
			(assetIn === Coin.btc.value && assetOut === Coin.hbd.value) ||
			(assetIn === Coin.hbd.value && assetOut === Coin.btc.value)
		) {
			if (!btcHbdPool) {
				swapResult = null;
				return;
			}
			const depths = getOrderedDepthsFor(btcHbdPool, assetIn);
			if (!depths) {
				swapResult = null;
				return;
			}
			result = calculateSwap(x, depths.X, depths.Y, slippageBps);
		} else {
			// BTC ↔ HIVE: two-hop via HBD. First pool is the one that
			// contains the input asset, second is the one that contains
			// the output asset.
			if (!btcHbdPool || !hiveHbdPool) {
				swapResult = null;
				return;
			}
			const pool1 = assetIn === Coin.btc.value ? btcHbdPool : hiveHbdPool;
			const pool2 = assetIn === Coin.btc.value ? hiveHbdPool : btcHbdPool;
			result = calculateTwoHopSwap(x, pool1, pool2, assetIn, Coin.hbd.value, assetOut, slippageBps);
		}

		if (!result) {
			swapResult = null;
			return;
		}
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
			const hop1 = result.hop1Fee
				? { asset: result.hop1Fee.asset, totalFee: result.hop1Fee.totalFee.toString() }
				: undefined;
			const prevHop1 = $SendTxDetails.swapHop1Fee;
			const hop1Changed = hop1
				? !prevHop1 || prevHop1.asset !== hop1.asset || prevHop1.totalFee !== hop1.totalFee
				: !!prevHop1;
			if (hop1Changed) {
				$SendTxDetails.swapHop1Fee = hop1;
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

	function formatUsd(amount: number): string {
		return amount.toLocaleString(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	let expectedOutputUsd = $derived.by(() => {
		const toCoinDef = $SendTxDetails.toCoin;
		if (!swapResult || swapResult.expectedOutput <= 0n || toPriceUsdRaw <= 0 || !toCoinDef)
			return null;
		return (Number(swapResult.expectedOutput) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
	});

	/** "You Receive" display value — formatted with thousands separator, same locale as the rest of the UI */
	let formattedToAmount = $derived.by(() => {
		const raw = $SendTxDetails.toAmount;
		const toCoinDef = $SendTxDetails.toCoin;
		if (!raw || raw === '0' || !toCoinDef) return null;
		const num = Number(raw);
		if (!Number.isFinite(num)) return null;
		return new Intl.NumberFormat(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: 0,
			maximumFractionDigits: toCoinDef.coin.decimalPlaces
		}).format(num);
	});

	let minAmountOutUsd = $derived.by(() => {
		const toCoinDef = $SendTxDetails.toCoin;
		if (!swapResult || swapResult.minAmountOut <= 0n || toPriceUsdRaw <= 0 || !toCoinDef)
			return null;
		return (Number(swapResult.minAmountOut) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
	});

	let inputAmountUsd = $derived.by(() => {
		const fromCoinDef = $SendTxDetails.fromCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!fromCoinDef || !fromAmount || fromAmount === '0' || fromPriceUsdRaw <= 0) return null;
		const amt = new CoinAmount(fromAmount, fromCoinDef.coin).toNumber();
		if (!Number.isFinite(amt) || amt <= 0) return null;
		return amt * fromPriceUsdRaw;
	});

	let exchangeFeePct = $derived(
		getAlteraFeePct(
			$SendTxDetails.fromCoin?.coin.value ?? '',
			$SendTxDetails.toCoin?.coin.value ?? ''
		)
	);

	/**
	 * Total protocol fee across all hops in USD.
	 * For two-hop routes (BTC↔HIVE), the intermediate hop fee is denominated in
	 * HBD (≈ $1 pegged). Final-hop fee is in the output coin.
	 */
	let totalProtocolFeeUsd = $derived.by(() => {
		const toCoinDef = $SendTxDetails.toCoin;
		if (!swapResult || toPriceUsdRaw <= 0 || !toCoinDef) return null;
		const finalHopUsd =
			(Number(swapResult.baseFee) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
		if (!swapResult.hop1Fee) return finalHopUsd;
		// hop1 intermediate is always HBD for BTC↔HIVE routes; HBD ≈ $1 pegged
		const hop1Usd = Number(swapResult.hop1Fee.baseFee) / 10 ** Coin.hbd.decimalPlaces;
		return hop1Usd + finalHopUsd;
	});

	const auth = $derived(getAuth()());

	// ── Destination state (from SwapDestination) ──
	const DEST_NETWORK_KEY = 'swap-dest-network';
	const isMainnet = vscNetworkId === 'vsc-mainnet';
	const chainLabel = isMainnet ? 'Mainnet' : 'Testnet';

	let destChoice: 'wallet' | 'address' = $state('wallet');
	let destAddress = $state('');

	function getStoredNetwork(): string {
		if (!browser) return 'mainnet';
		return localStorage.getItem(DEST_NETWORK_KEY) || 'mainnet';
	}
	let destNetworkChoice: string = $state(getStoredNetwork());

	$effect(() => {
		if (browser) {
			localStorage.setItem(DEST_NETWORK_KEY, destNetworkChoice);
		}
	});

	// Update toNetwork based on destination choice
	$effect(() => {
		if (destChoice === 'wallet') {
			if ($SendTxDetails.toNetwork?.value !== Network.magi.value) {
				$SendTxDetails.toNetwork = Network.magi;
			}
		} else {
			const net =
				destNetworkChoice === 'magi'
					? Network.magi
					: ($SendTxDetails.toCoin?.networks?.find(
							(n: Network) => n.value !== Network.magi.value
						) ?? Network.hiveMainnet);
			if ($SendTxDetails.toNetwork?.value !== net.value) {
				$SendTxDetails.toNetwork = net;
			}
		}
	});

	// Update toUsername when sending to address
	$effect(() => {
		if (destChoice === 'address' && destAddress.trim()) {
			$SendTxDetails.toUsername = destAddress.trim();
		}
	});

	// ── Combined editStage: swap fields valid AND destination valid ──
	let swapFieldsValid = $state(false);
	$effect(() => {
		const valid = !!(
			$SendTxDetails.toNetwork &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toAmount !== '0' &&
			$SendTxDetails.toCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.fromAmount &&
			$SendTxDetails.fromAmount !== '0' &&
			$SendTxDetails.fromCoin
		);
		swapFieldsValid = valid;
		untrack(() => {
			if (valid) {
				getFee($SendTxDetails.toAmount).then((fee) => {
					if (
						fee?.amount !== $SendTxDetails.fee?.amount ||
						fee?.coin.value !== $SendTxDetails.fee?.coin.value
					)
						$SendTxDetails.fee = fee;
				});
			}
		});
	});

	// Destination valid check. When the target coin is BTC AND the
	// user picked "Send to address" on a mainnet settlement, the
	// entered address must parse as a Bitcoin address on the right
	// network. Non-BTC targets only require a non-empty string.
	let destValid = $derived.by(() => {
		if (destChoice === 'wallet') return true;
		const addr = destAddress.trim();
		if (!addr) return false;
		const isBtcTarget = $SendTxDetails.toCoin?.coin.value === Coin.btc.value;
		const wantsMainnet = destNetworkChoice === 'mainnet';
		if (isBtcTarget && wantsMainnet) {
			const net = isVscTestnet() ? BtcNetwork.testnet : BtcNetwork.mainnet;
			return validateBtcAddr(addr, net);
		}
		return true;
	});

	/**
	 * True when the input amount exceeds 50% of the relevant pool's input-side
	 * reserve. The contract hard-caps swaps at this threshold; any transaction
	 * beyond it will be rejected on-chain, so we block submission here.
	 * For two-hop routes we check both pools: the direct input vs pool1, and
	 * the estimated intermediate amount vs pool2's input reserve.
	 */
	let exceedsPoolDepth = $derived.by(() => {
		const fromCoin = $SendTxDetails.fromCoin;
		const toCoin = $SendTxDetails.toCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!fromCoin || !toCoin || !fromAmount || fromAmount === '0') return false;

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) return false;

		return checkExceedsPoolDepth(
			BigInt(fromAmountInt),
			fromCoin.coin.value,
			toCoin.coin.value,
			hiveHbdPool,
			btcHbdPool
		);
	});

	// Combined: enable button when swap fields valid, destination valid, not same coin, and has balance
	$effect(() => {
		if (!isActive) return;
		editStage(
			swapFieldsValid && destValid && !sameCoinError && !insufficientBalance && !exceedsPoolDepth
		);
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
			const btcOption = assetOptions.find(
				(opt) => opt.coin.value === Coin.btc.value && !opt.disabled
			);
			const firstAvailable = assetOptions.find((opt) => !opt.disabled);
			const fromOpt = btcOption ?? firstAvailable;
			if (fromOpt)
				SendTxDetails.update((d) => ({
					...d,
					fromCoin: fromOpt,
					fromNetwork: Network.magi
				}));
		}

		// TO auto selection, update only if value changes!
		const visibleToObjs = toAssetObjs.filter((obj) => {
			const coinDef = Object.values(Coin).find((c) => c.value === obj.value);
			if (!coinDef) return false;
			const bal = getBalanceSmallestUnits($accountBalance, coinDef, Network.magi);
			return bal > 0.001;
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

	// Same-coin error: show when from and to are the same asset
	let sameCoinError = $derived(
		$SendTxDetails.fromCoin && $SendTxDetails.toCoin
			? $SendTxDetails.fromCoin.coin.value === $SendTxDetails.toCoin.coin.value
			: false
	);

	// Insufficient balance: check if from amount exceeds available balance
	let insufficientBalance = $derived.by(() => {
		const from = $SendTxDetails.fromCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!from || !fromAmount || fromAmount === '0') return false;
		const bal = getBalanceSmallestUnits(
			$accountBalance,
			from.coin,
			$SendTxDetails.fromNetwork ?? Network.magi
		);
		if (bal <= 0) return true;
		const inputNum = new CoinAmount(fromAmount, from.coin).toNumber();
		const balNum = new CoinAmount(bal, from.coin, true).toNumber();
		return inputNum > balNum;
	});

	const fromAssetObjs: AssetObject[] = $derived([
		{
			...Coin.btc,
			snippet: assetCard,
			snippetData: {
				fromOpt: { coin: Coin.btc, networks: [Network.magi] },
				net: Network.magi,
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
		// (even when expectedOutput is 0 — e.g. amount exceeds pool reserves)
		if (swapResult) return;
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

	let fromPriceUsdRaw = $state(0);
	let toPriceUsdRaw = $state(0);
	$effect(() => {
		if ($SendTxDetails.fromCoin) {
			new CoinAmount(1, $SendTxDetails.fromCoin.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amt) => {
					fromPriceUsdRaw = amt.toNumber();
				});
		}
		if ($SendTxDetails.toCoin) {
			new CoinAmount(1, $SendTxDetails.toCoin.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amt) => {
					toPriceUsdRaw = amt.toNumber();
				});
		}
	});

	let minAmount: CoinAmount<Coin> | undefined = $state();
	$effect(() => {
		const amt =
			$SendTxDetails.fromCoin?.coin.value === Coin.btc.value
				? new CoinAmount(0.00000001, Coin.btc)
				: undefined;
		untrack(() => {
			if (minAmount?.coin.value !== amt?.coin.value || minAmount?.toNumber() !== amt?.toNumber()) {
				minAmount = amt;
			}
		});
	});

	// Max balance for the selected from coin. Depends on the source
	// network: Magi reads from `$accountBalance.bal`, Hive Mainnet
	// reads from `$accountBalance.connectedBal` (the L1 account
	// snapshot populated by aioha).
	const maxAmount: CoinAmount<Coin> | undefined = $derived.by(() => {
		const from = $SendTxDetails.fromCoin;
		const fromNet = $SendTxDetails.fromNetwork;
		if (!from) return undefined;
		const coinValue = from.coin.value;
		if (fromNet?.value === Network.hiveMainnet.value) {
			const connected = $accountBalance.connectedBal;
			if (!connected) return undefined;
			const bal = connected[coinValue as keyof typeof connected];
			if (bal == null || typeof bal !== 'number' || bal <= 0) return undefined;
			return new CoinAmount(bal, from.coin, true);
		}
		const key = coinValue as keyof AccountBalance;
		const bal = $accountBalance.bal?.[key];
		if (bal == null || typeof bal !== 'number' || bal <= 0) return undefined;
		return new CoinAmount(bal, from.coin, true);
	});

	let dialogOpen = $state(false);
	let toggle = $state<(open?: boolean) => void>(() => {});
	let currentlyOpen: 'from' | 'to' = $state('from');

	// ── Multi-step dialog state ──
	let dialogStep = $state<'tokens' | 'source'>('tokens');
	const dialogBack = $derived(
		dialogStep === 'source'
			? () => {
					dialogStep = 'tokens';
					tempCoinOpt = undefined;
				}
			: undefined
	);
	let tempCoinOpt: CoinOptions['coins'][number] | undefined = $state();
	let tokenSearch = $state('');

	function openDialog(state: 'from' | 'to') {
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
			// Show balance sources for the selected token
			dialogStep = 'source';
		} else {
			// To selection: always use Magi network
			confirmToSelection(coinOpt, Network.magi);
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

	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? Coin.unk);

	let priceImpactPct = $derived.by(() => {
		const fromCoinDef = $SendTxDetails.fromCoin;
		const toCoinDef = $SendTxDetails.toCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!fromCoinDef || !toCoinDef || !fromAmount || fromAmount === '0') return 0;
		if (!swapResult || swapResult.expectedOutput <= 0n) return 0;
		const fromAmountInt = new CoinAmount(fromAmount, fromCoinDef.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) return 0;
		return calculatePriceImpact(
			BigInt(fromAmountInt),
			fromCoinDef.coin.value,
			toCoinDef.coin.value,
			hiveHbdPool,
			btcHbdPool
		);
	});
</script>

<Dialog bind:open={dialogOpen} bind:toggle back={dialogBack}>
	{#snippet title()}Select a token{/snippet}
	{#snippet content()}
		{#if dialogStep === 'tokens'}
			<!-- Step 1: Select a token -->
			<div class="dialog-content">
				<div class="token-search-wrapper">
					<Search size={16} />
					<input bind:value={tokenSearch} placeholder="Search tokens..." />
				</div>
				<div class="token-chip-grid">
					{#each getFilteredTokens(currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs) as token (token.value)}
						<button class="token-chip" onclick={() => selectToken(token)}>
							<img src={token.icon} alt={token.label} class="chip-icon" />
							<span>{coinDisplayLabel(token)}</span>
						</button>
					{/each}
				</div>
				<span class="dialog-section-label">ALL ASSETS</span>
				<p class="dialog-hint">select a token to see your available balances</p>
			</div>
		{:else if dialogStep === 'source' && tempCoinOpt}
			<!-- Step 2: Show balances for selected token -->
			<div class="dialog-content">
				<div class="token-chip-grid">
					{#each getFilteredTokens(currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs) as token (token.value)}
						<button
							class={['token-chip', { active: token.value === tempCoinOpt.coin.value }]}
							onclick={() => selectToken(token)}
						>
							<img src={token.icon} alt={token.label} class="chip-icon" />
							<span>{coinDisplayLabel(token)}</span>
						</button>
					{/each}
				</div>
				<span class="dialog-section-label">ALL ASSETS</span>
				<div class="network-cards">
					{#each tempCoinOpt.networks.filter((n) => n.value !== Network.lightning.value) as net (net.value)}
						<button class="network-card" onclick={() => confirmFromSelection(tempCoinOpt!, net)}>
							<img src={tempCoinOpt.coin.icon} alt="" class="network-card-icon" />
							<div class="network-card-info">
								<span class="network-card-name"
									>{net.value === Network.magi.value ? 'Magi Network' : 'Mainnet'}</span
								>
							</div>
							<div class="network-card-balance">
								<span class="balance-amount"
									>{getNetworkBalance(tempCoinOpt.coin.value, net.value)}</span
								>
								<span class="balance-label sm-caption">available</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/snippet}
</Dialog>

<div class="swap-layout">
	<!-- ── Swap Card ── -->
	<div class="swap-col-left">
		<div class="quick-swap-card">
			<!-- From Section -->
			<div class="swap-section">
				<div class="section-header">
					<span class="section-label">From</span>
					<span class="section-header-center">
						{#if $SendTxDetails.fromNetwork}
							<span class="network-pill">{$SendTxDetails.fromNetwork.label}</span>
						{/if}
					</span>
					<span class="section-balance sm-caption">
						{#if $SendTxDetails.fromCoin && maxAmount}
							Balance: {maxAmount.toPrettyAmountString()}
							{coinDisplayLabel($SendTxDetails.fromCoin.coin)}
						{/if}
					</span>
				</div>
				<div class="section-input-row">
					<div class="input-field">
						<AmountInput
							bind:coinAmount={inputAmount}
							coinOpts={amountInputCoinOpts}
							{minAmount}
							{maxAmount}
							hideUnit
							hideUsd
							hideNetwork
						/>
					</div>
					<button class="token-selector-btn" onclick={() => openDialog('from')}>
						{#if $SendTxDetails.fromCoin}
							<img
								src={$SendTxDetails.fromCoin.coin.icon}
								alt={coinDisplayLabel($SendTxDetails.fromCoin.coin)}
								class="token-icon"
							/>
							<span class="token-name">{coinDisplayLabel($SendTxDetails.fromCoin.coin)}</span>
						{:else}
							<span class="token-name">Select</span>
						{/if}
						<ChevronDown size={14} />
					</button>
				</div>
				<div class="section-usd-row">
					<span class="section-usd-approx">
						{#if inputAmountUsd !== null}≈ ${formatUsd(inputAmountUsd)}{/if}
					</span>
					{#if sameCoinError}
						<span class="section-error-inline">Select a different token</span>
					{:else if insufficientBalance && $SendTxDetails.fromCoin}
						<span class="section-error-inline"
							>Insufficient {coinDisplayLabel($SendTxDetails.fromCoin.coin)} balance</span
						>
					{:else if exceedsPoolDepth}
						<span class="section-error-inline">Amount exceeds pool depth</span>
					{/if}
				</div>
			</div>

			<!-- Swap Arrow -->
			<div class="swap-toggle-wrapper">
				<div class="swap-arrow">
					<ChevronDown size={18} />
				</div>
			</div>

			<!-- To Section -->
			<div class="swap-section">
				<div class="section-header">
					<span class="section-label">You Receive</span>
					<span class="sm-caption" style="color: var(--dash-text-muted)">
						{#if $SendTxDetails.toNetwork}
							{$SendTxDetails.toNetwork.label}
						{:else}
							Select destination
						{/if}
					</span>
				</div>
				<div class="section-input-row">
					<div class="to-amount-display">
						{#if formattedToAmount}
							<span class="to-amount-value">{formattedToAmount}</span>
						{:else}
							<span class="to-amount-placeholder">0</span>
						{/if}
					</div>
					<button class="token-selector-btn" onclick={() => openDialog('to')}>
						{#if $SendTxDetails.toCoin}
							<img
								src={$SendTxDetails.toCoin.coin.icon}
								alt={coinDisplayLabel($SendTxDetails.toCoin.coin)}
								class="token-icon"
							/>
							<span class="token-name">{coinDisplayLabel($SendTxDetails.toCoin.coin)}</span>
						{:else}
							<span class="token-name">Select</span>
						{/if}
						<ChevronDown size={14} />
					</button>
				</div>
				<div class="section-usd-row">
					<span class="section-usd-approx">
						{#if expectedOutputUsd !== null}≈ ${formatUsd(expectedOutputUsd)}{/if}
					</span>
				</div>
			</div>

			<!-- Route Info -->
			{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
				<div class="route-info">
					<span class="route-tags">
						<span class="tag native">Native</span>
						<span class="tag-sep">&middot;</span>
						<span class="tag muted">No wrap</span>
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- ── CENTER RIGHT: Deliver To ── -->
	<div class="swap-col-right">
		<!-- Deliver To Section -->
		<div class="deliver-to-card">
			<span class="deliver-label">DELIVER TO</span>

			{#if $SendTxDetails.toCoin}
				<div class="dest-header">
					<CoinNetworkIcon
						coin={toCoin}
						network={$SendTxDetails.toNetwork ?? Network.magi}
						size={28}
					/>
					<h3>Where should {coinDisplayLabel(toCoin)} go?</h3>
				</div>
			{/if}

			<div class="dest-options">
				<button
					class="dest-card"
					class:selected={destChoice === 'wallet'}
					onclick={() => {
						destChoice = 'wallet';
					}}
				>
					<div class="dest-card-icon"><Wallet size={18} /></div>
					<div class="dest-card-info">
						<span class="dest-card-name">Keep on Magi Network</span>
						<span class="dest-card-desc sm-caption"
							>Swap to yourself &middot; Asset stays on Magi.</span
						>
					</div>
					<div class="dest-radio" class:checked={destChoice === 'wallet'}></div>
				</button>

				{#if destChoice === 'wallet'}
					{@const connectedWalletLabel =
						auth.value?.provider === 'aioha'
							? 'HIVE'
							: auth.value?.did?.startsWith('did:pkh:bip122:')
								? 'BTC'
								: 'EVM'}
					<div class="wallet-settle-info">
						<span class="settle-dot"></span>
						<span class="settle-text"
							>{coinDisplayLabel(toCoin)} will settle natively in your {connectedWalletLabel}
							wallet on Magi.</span
						>
					</div>
				{/if}

				<button
					class="dest-card"
					class:selected={destChoice === 'address'}
					onclick={() => {
						destChoice = 'address';
					}}
				>
					<div class="dest-card-icon"><Send size={18} /></div>
					<div class="dest-card-info">
						<span class="dest-card-name">Send to address</span>
						<span class="dest-card-desc sm-caption"
							>Enter a recipient address &middot; Choose Magi or mainnet settlement</span
						>
					</div>
					<div class="dest-radio" class:checked={destChoice === 'address'}></div>
				</button>
			</div>

			<!-- Address Section -->
			<div class="dest-address-section" class:hidden={destChoice !== 'address'}>
				<div class="dest-network-row">
					<span class="dest-network-label">Target Network</span>
					<div class="dest-network-toggle">
						<button
							class:active={destNetworkChoice === 'mainnet'}
							onclick={() => {
								destNetworkChoice = 'mainnet';
							}}>{chainLabel}</button
						>
						<button
							class:active={destNetworkChoice === 'magi'}
							onclick={() => {
								destNetworkChoice = 'magi';
							}}>Magi Network</button
						>
					</div>
				</div>
				<textarea
					bind:value={destAddress}
					placeholder="Paste Hive, BTC, EVM or DASH address... *"
					rows="2"
					class:empty-required={destChoice === 'address' && !destAddress?.trim()}
					disabled={destChoice !== 'address'}
				></textarea>
				<p class="dest-hint sm-caption">
					{coinDisplayLabel(toCoin)} arrives on {destNetworkChoice === 'magi' ? 'Magi' : chainLabel} &mdash;
					accepts Hive, BTC, EVM or DASH addresses
				</p>
			</div>
		</div>
		<!-- Fees Section (collapsible) -->
		{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
			{@const fromDec = $SendTxDetails.fromCoin.coin.decimalPlaces}
			{@const toDec = $SendTxDetails.toCoin.coin.decimalPlaces}
			{@const fromUnit = coinDisplayLabel($SendTxDetails.fromCoin.coin)}
			{@const toUnit = coinDisplayLabel($SendTxDetails.toCoin.coin)}
			{@const hop1FeeCoin = swapResult?.hop1Fee
				? swapResult.hop1Fee.asset === Coin.hbd.value
					? Coin.hbd
					: swapResult.hop1Fee.asset === Coin.hive.value
						? Coin.hive
						: swapResult.hop1Fee.asset === Coin.btc.value
							? Coin.btc
							: null
				: null}
			<div class="swap-fees">
				<!-- Always visible: price impact summary row -->
				<div class="fees-impact-row">
					<span class="fee-label">Price Impact</span>
					{#if swapResult && priceImpactPct > 0}
						<span
							class="impact-pct"
							class:good={priceImpactPct < 2}
							class:medium={priceImpactPct >= 2 && priceImpactPct < 10}
							class:bad={priceImpactPct >= 10}>{priceImpactPct.toFixed(2)}%</span
						>
					{:else}
						<span class="impact-pct-empty">—</span>
					{/if}
				</div>

				<!-- Always visible: slippage + toggle header -->
				<div class="fees-header">
					<span class="fee-label">Slippage Tolerance</span>
					<div class="fees-header-right">
						<div class="slippage-options">
							{#each slippageOptions as bps}
								<button
									class={{ active: slippageBps === bps && !customSlippageOpen }}
									onclick={() => {
										slippageBps = bps;
										customSlippageOpen = false;
									}}
								>
									{(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
								</button>
							{/each}
							{#if customSlippageOpen}
								<div class="custom-slippage" class:invalid={customSlippageInvalid}>
									<input
										bind:this={customSlippageInputEl}
										type="text"
										inputmode="decimal"
										placeholder="0.5"
										bind:value={customSlippageInput}
										oninput={() => {
											// Normalise decimal separator only — validate on commit.
											customSlippageInput = customSlippageInput.replace(',', '.');
										}}
										onblur={applyCustomSlippage}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												applyCustomSlippage();
												e.currentTarget.blur();
											}
											if (e.key === 'Escape') {
												customSlippageOpen = false;
											}
										}}
									/>
									<span class="custom-slippage-unit">%</span>
								</div>
							{:else}
								<button
									class={{ active: !slippageOptions.includes(slippageBps) }}
									onclick={() => {
										customSlippageOpen = true;
										customSlippageInput = slippageOptions.includes(slippageBps)
											? ''
											: parseFloat((slippageBps / 100).toFixed(2)).toString();
									}}
								>
									{slippageOptions.includes(slippageBps)
										? 'Custom'
										: `${parseFloat((slippageBps / 100).toFixed(2))}%`}
								</button>
							{/if}
						</div>
					</div>
				</div>

				<!-- Text warning — always rendered to reserve space; visibility toggled via CSS -->
				<div
					class="impact-warning"
					class:severe={priceImpactPct >= 15}
					class:hidden={priceImpactPct < 10}
				>
					<TriangleAlert size={14} />
					<!-- Both messages stacked in the same grid cell so height never changes -->
					<div class="impact-text">
						<span class="impact-severe"
							>Very high price impact. Pool liquidity is low for this trade size. Try a smaller
							amount.</span
						>
						<span class="impact-medium"
							>High price impact. Consider using a smaller amount for better rates.</span
						>
					</div>
				</div>

				<!-- Fee breakdown — always visible when a swap is calculated -->
				{#if swapResult}
					<div class="fee-details">
						<div class="fee-row">
							<span class="fee-label">Expected Output</span>
							<span class="fee-value fee-value-stack">
								<span>{formatSmallUnits(swapResult.expectedOutput, toDec)} {toUnit}</span>
								{#if expectedOutputUsd !== null}
									<span class="usd-approx">≈ ${formatUsd(expectedOutputUsd)}</span>
								{/if}
							</span>
						</div>
						<!-- Protocol fee: 0.08% per pool (0.16% total for two-hop routes) -->
						<div class="fee-row">
							<span class="fee-label">
								Protocol Fee
								<span class="fee-sublabel">({swapResult.hop1Fee ? '0.16%' : '0.08%'})</span>
							</span>
							<span class="fee-value">
								{#if totalProtocolFeeUsd !== null}
									≈ ${formatUsd(totalProtocolFeeUsd)}
								{:else}
									—
								{/if}
							</span>
						</div>
						{#if exchangeFeePct !== null}
							<div class="fee-row">
								<span class="fee-label">
									Exchange Fee
									<span class="fee-sublabel">(Altera)</span>
								</span>
								<span
									class="fee-value"
									class:fee-free={exchangeFeePct === 0}
									class:fee-cost={exchangeFeePct > 0}
								>
									{exchangeFeePct === 0 ? 'Free' : `${exchangeFeePct}%`}
								</span>
							</div>
						{/if}
						<div class="fee-row">
							<span class="fee-label">Min amount received</span>
							<span class="fee-value fee-value-stack">
								<span>{formatSmallUnits(swapResult.minAmountOut, toDec)} {toUnit}</span>
								{#if minAmountOutUsd !== null}
									<span class="usd-approx">≈ ${formatUsd(minAmountOutUsd)}</span>
								{/if}
							</span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Status & Waiting Overlay -->
{#if status.message}
	<div class="status-wrapper">
		<span class="sm-caption">Status</span>
		<p class={{ status: !status.isError, error: status.isError }}>{status.message}</p>
	</div>
{/if}
{#if waiting}
	<div class="waiting-overlay">
		<div class="waiting-card">
			<WaveLoading size={32} />
			<div class="info">
				<p>Waiting for signature</p>
				<span>
					<PillButton onclick={() => abort()} theme="secondary" styleType="invert">
						<X /> Cancel
					</PillButton>
				</span>
				{#if auth.value?.provider === 'aioha'}
					<p class="warning">
						<b class="error">Warning:</b> Transaction may still occur if it is authorized later via your
						hive wallet.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	/* ═══ Layout ═══ */
	.swap-layout {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 480px;
		min-width: 320px;
		width: 100%;
		margin: 0 auto;
		padding: 0.5rem;
		box-sizing: border-box;
	}
	/* On wide screens (sidebar visible) give the card a bit more room */
	@media screen and (min-width: 860px) {
		.swap-layout {
			max-width: 560px;
		}
	}
	.swap-col-left {
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
	}
	.swap-col-right {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
		padding-bottom: 16px;
	}

	/* ── Quick Swap Card ── */
	.quick-swap-card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1rem;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* ── Swap Section (From / To) ── */
	.swap-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 16px;
		padding: 0.75rem;
	}
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.section-label {
		flex: 1;
		font-size: 0.8rem;
		color: var(--dash-text-muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.section-header-center {
		flex: 1;
		display: flex;
		justify-content: center;
	}
	.section-balance {
		flex: 1;
		text-align: right;
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
	}
	.network-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.45rem;
		border-radius: 1rem;
		border: 1px solid var(--dash-accent-purple);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--dash-accent-purple);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.section-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 3rem;
	}
	.input-field {
		flex: 1;
		min-width: 0;
		--number-input-padding-right: 0;
	}
	.input-field :global(.normal-wrapper label) {
		display: none;
	}
	.input-field :global(.normal-wrapper .amount-input) {
		border: none;
		background: transparent;
		padding: 0;
		gap: 0;
	}
	.input-field :global(.normal-wrapper .amount-input > .icons),
	.input-field :global(.normal-wrapper .amount-input > svg) {
		display: none;
	}
	.input-field :global(.normal-wrapper .amount-input [data-part='input']) {
		font-size: 1.5rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		height: auto;
		border: none;
		border-radius: 0;
		padding: 0.5rem 0;
	}
	.input-field :global(.normal-wrapper .amount-input:has(input:focus-visible)) {
		box-shadow: none;
		border-bottom-color: transparent;
		border-radius: 0;
	}
	/* Hide AmountInput's internal validation error — errors are shown inline
	   in the section-usd-row instead, which doesn't shift the layout. */
	.input-field :global(.normal-wrapper .bottom-info) {
		display: none;
	}
	.to-amount-display {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.8rem;
		font-size: 1.5rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
	}
	.to-amount-value {
		color: var(--dash-text-primary);
	}
	.to-amount-placeholder {
		color: var(--dash-text-muted);
	}

	/* ── Token Selector Button ── */
	.token-selector-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background-color: var(--dash-surface);
		border: 1px solid var(--dash-card-border);
		border-radius: 2rem;
		cursor: pointer;
		color: var(--dash-text-primary);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		transition: background-color 0.15s ease;
		&:hover {
			background-color: var(--dash-card-border);
		}
		&.fixed {
			cursor: default;
			&:hover {
				background-color: var(--dash-surface);
			}
		}
		.token-icon {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 50%;
		}
		.token-name {
			font-weight: 600;
		}
	}

	/* ── Swap Toggle ── */
	.swap-toggle-wrapper {
		display: flex;
		justify-content: center;
		padding: 0.125rem 0;
		position: relative;
		z-index: 1;
	}
	.swap-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 12px;
		border: 1px solid var(--dash-card-border);
		background: var(--dash-card-bg);
		color: var(--dash-text-secondary);
		pointer-events: none;
	}

	/* ── Same Coin Error ── */
	/* ── Route Info ── */
	.route-info {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.375rem 0 0.125rem;
		font-size: 0.75rem;
	}
	.route-tags {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.tag.native {
		color: var(--dash-accent-green);
		font-weight: 500;
		&::before {
			content: '';
			display: inline-block;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background-color: var(--dash-accent-green);
			margin-right: 0.25rem;
		}
	}
	.tag-sep {
		color: var(--dash-text-muted);
	}
	.tag.muted {
		color: var(--dash-text-muted);
	}

	/* ── Fees Section (collapsible) ── */
	.swap-fees {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		background-color: var(--dash-surface);
		overflow: hidden;
	}
	.fees-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		flex-wrap: wrap;
	}
	.fees-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.fee-details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 1rem 0.75rem;
		border-top: 1px solid var(--dash-card-border);
		padding-top: 0.75rem;
	}
	.fee-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.125rem 0;
	}
	.fee-label {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
	}
	.fee-sublabel {
		font-size: var(--text-xs);
		opacity: 0.7;
	}
	.fee-value {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
		font-size: var(--text-sm);
		color: var(--dash-text-primary);
		text-align: right;
		white-space: nowrap;
	}
	.fee-value-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
		span {
			white-space: nowrap;
		}
	}
	.usd-approx {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
	}
	.section-usd-row {
		display: flex;
		flex-wrap: wrap-reverse;
		justify-content: space-between;
		align-items: center;
		min-height: 1.4em;
		gap: 0.125rem 0.5rem;
	}
	.section-usd-approx {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.section-error-inline {
		font-size: var(--text-xs);
		color: var(--negative-text, #f87171);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		margin-left: auto;
	}
	.fee-free {
		color: var(--dash-accent-green) !important;
	}
	.fee-cost {
		color: #f59e0b !important;
	}
	.slippage-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
		button {
			padding: 0.25rem 0.5rem;
			border: 1px solid var(--dash-card-border);
			border-radius: 12px;
			background: transparent;
			color: var(--dash-text-secondary);
			cursor: pointer;
			font-size: var(--text-xs);
			font-weight: 500;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease;
			&.active {
				background-color: var(--dash-accent-purple);
				color: var(--dash-text-primary);
				border-color: var(--dash-accent-purple);
			}
			&:hover:not(.active) {
				background-color: var(--dash-card-border);
			}
		}
	}
	.custom-slippage {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--dash-accent-purple);
		border-radius: 12px;
		background: rgba(111, 106, 248, 0.1);
		transition: border-color 0.15s ease;
		&.invalid {
			border-color: var(--dash-accent-red);
			background: rgba(239, 68, 68, 0.08);
		}
		input {
			width: 2.5rem;
			height: auto;
			border: none;
			background: transparent;
			color: var(--dash-text-primary);
			font: inherit;
			font-size: var(--text-xs);
			font-weight: 600;
			outline: none;
			text-align: center;
			-moz-appearance: textfield;
			&::placeholder {
				color: var(--dash-text-muted);
				font-weight: 400;
			}
			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}
		}
		.custom-slippage-unit {
			font-size: var(--text-xs);
			font-weight: 600;
			color: var(--dash-accent-purple);
		}
	}

	/* ═══ Right Column: Deliver To ═══ */
	.deliver-to-card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.deliver-label {
		color: var(--dash-text-muted);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.dest-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
		h3 {
			margin: 0;
			font-size: var(--text-xl);
			font-weight: 600;
			color: var(--dash-text-primary);
		}
	}

	/* ── Destination Options ── */
	.dest-options {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.dest-card {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		background-color: var(--dash-swap-field-bg);
		cursor: pointer;
		color: var(--dash-text-primary);
		font: inherit;
		text-align: left;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
		&.selected {
			border-color: var(--dash-accent-purple);
			background: var(--dash-card-bg);
		}
		&:hover:not(.selected) {
			border-color: var(--dash-card-border);
			background-color: var(--dash-surface);
		}
		.dest-card-icon {
			width: 2rem;
			height: 2rem;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 12px;
			background-color: var(--dash-surface);
			flex-shrink: 0;
			color: var(--dash-text-secondary);
		}
		.dest-card-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}
		.dest-card-name {
			font-weight: 600;
			font-size: 0.875rem;
		}
		.dest-card-desc {
			color: var(--dash-text-muted);
		}
	}
	.dest-radio {
		width: 1.125rem;
		height: 1.125rem;
		border: 2px solid var(--dash-card-border);
		border-radius: 50%;
		flex-shrink: 0;
		position: relative;
		transition: border-color 0.15s ease;
		&.checked {
			border-color: var(--dash-accent-purple);
			&::after {
				content: '';
				position: absolute;
				top: 3px;
				left: 3px;
				width: calc(100% - 6px);
				height: calc(100% - 6px);
				border-radius: 50%;
				background-color: var(--dash-accent-purple);
			}
		}
	}
	.wallet-settle-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		background-color: rgba(108, 92, 231, 0.08);
		border: 1px solid rgba(108, 92, 231, 0.2);
		border-radius: 12px;
		margin-top: -0.25rem;
	}
	.settle-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--dash-accent-green);
		flex-shrink: 0;
	}
	.settle-text {
		color: var(--dash-accent-green);
		font-size: 0.75rem;
		font-family: 'Noto Sans Mono Variable', monospace;
	}

	/* ── Address Section ── */
	.dest-address-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		transition: opacity 0.15s ease;
		&.hidden {
			opacity: 0;
			pointer-events: none;
			max-height: 0;
			overflow: hidden;
			margin: 0;
			gap: 0;
		}
		textarea {
			width: 100%;
			box-sizing: border-box;
			padding: 0.625rem;
			border: 1px solid var(--dash-input-border);
			border-radius: 12px;
			background-color: var(--dash-swap-field-bg);
			color: var(--dash-text-primary);
			font: inherit;
			font-size: var(--text-sm);
			resize: none;
			transition: border-color 0.15s ease;
			&::placeholder {
				color: var(--dash-text-muted);
			}
			&.empty-required {
				border-color: rgba(226, 89, 91, 0.5);
			}
		}
	}
	.dest-network-row {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.dest-network-label {
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
	}
	.dest-network-toggle {
		display: flex;
		gap: 0;
		border: 1px solid var(--dash-input-border);
		border-radius: 12px;
		overflow: hidden;
		button {
			flex: 1;
			padding: 0.5rem 0.75rem;
			border: none;
			background: transparent;
			color: var(--dash-text-muted);
			font: inherit;
			font-size: var(--text-sm);
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				color 0.15s ease;
			&.active {
				background-color: var(--dash-accent-purple);
				color: var(--dash-text-primary);
			}
			&:not(.active):hover {
				background-color: var(--dash-surface);
			}
		}
	}
	.dest-hint {
		margin: 0;
		color: var(--dash-text-muted);
	}

	/* ── Dialog: Token Grid ── */
	.token-search-wrapper {
		position: relative;
		margin-bottom: 1rem;
		:global(svg) {
			position: absolute;
			left: 0.75rem;
			top: 50%;
			transform: translateY(-50%);
			color: var(--dash-text-muted);
			pointer-events: none;
		}
		input {
			width: 100%;
			box-sizing: border-box;
			padding: 0.625rem 0.75rem 0.625rem 2.25rem;
			border: 1px solid var(--dash-input-border);
			border-radius: 12px;
			background-color: var(--dash-swap-field-bg);
			color: var(--dash-text-primary);
			font: inherit;
			font-size: var(--text-sm);
			&::placeholder {
				color: var(--dash-text-muted);
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
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 2rem;
		background-color: var(--dash-surface);
		color: var(--dash-text-primary);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
		&:hover {
			background-color: var(--dash-card-border);
			border-color: var(--dash-accent-purple);
		}
		.chip-icon {
			width: 1.25rem;
			height: 1.25rem;
			border-radius: 50%;
		}
	}

	.dialog-section-label {
		display: block;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--dash-text-muted);
	}
	.dialog-hint {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
		text-align: center;
		margin: 1rem 0 0;
	}
	.token-chip.active {
		border-color: var(--dash-accent-purple);
		background-color: rgba(111, 106, 248, 0.15);
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
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		background-color: var(--dash-swap-field-bg);
		cursor: pointer;
		color: var(--dash-text-primary);
		font: inherit;
		text-align: left;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
		&:hover {
			border-color: var(--dash-accent-purple);
			background: var(--dash-card-bg);
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

	/* ── Price Impact Summary Row ── */
	.fees-impact-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.625rem 1rem 0;
	}
	.impact-pct {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		font-weight: 600;
		&.good {
			color: var(--dash-accent-green);
		}
		&.medium {
			color: #d97706;
		}
		&.bad {
			color: var(--dash-accent-red);
		}
	}
	.impact-pct-empty {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
	}

	/* ── Price Impact Warning ── */
	.impact-warning {
		display: flex;
		align-items: start;
		gap: 0.5rem;
		padding: 0.375rem 1rem;
		border-top: 1px solid var(--dash-card-border);
		color: #d97706; /* amber-600 */
		font-size: var(--text-sm);
		:global(svg) {
			flex-shrink: 0;
		}
		&.severe {
			color: var(--dash-accent-red);
		}
		/* Hidden state — keeps layout space, just invisible */
		&.hidden {
			visibility: hidden;
		}
	}
	/* Both message variants stacked in one grid cell — container height is
	   always the taller of the two, so nothing shifts when the text changes. */
	.impact-text {
		display: grid;
		.impact-severe,
		.impact-medium {
			grid-area: 1 / 1;
			visibility: hidden;
		}
	}
	.impact-warning.severe .impact-severe {
		visibility: visible;
	}
	.impact-warning:not(.severe):not(.hidden) .impact-medium {
		visibility: visible;
	}

	/* ── Status & Waiting ── */
	.status-wrapper {
		max-width: 72rem;
		margin: 1rem auto 0;
		padding: 0 1.5rem;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.waiting-overlay {
		position: fixed;
		width: 100vw;
		height: 100vh;
		top: 50%;
		left: 50%;
		transform: translate(-50dvw, -50dvh);
		display: flex;
		justify-content: center;
		background-color: rgba(10, 10, 18, 0.6);
		backdrop-filter: blur(4px);
		pointer-events: none;
		z-index: 1;
		.waiting-card {
			margin-top: 25%;
			font-weight: 500;
			padding: 1.5rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			pointer-events: all;
			background: var(--dash-card-bg);
			border: 1px solid var(--dash-card-border);
			border-radius: 16px;
			height: min-content;
			color: var(--dash-text-primary);
			.info {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				.warning {
					max-width: 20rem;
					text-align: center;
				}
			}
		}
	}

	@media screen and (max-width: 36rem) {
		.quick-swap-card {
			padding: 1rem;
		}
		.deliver-to-card {
			padding: 1rem;
		}
		.dest-header h3 {
			font-size: var(--text-lg);
		}
		.dest-card {
			padding: 0.75rem;
			gap: 0.5rem;
		}
		.dest-network-toggle button {
			padding: 0.375rem 0.5rem;
			font-size: var(--text-xs);
		}
		.waiting-overlay .waiting-card {
			margin-top: 15%;
			margin-left: 1rem;
			margin-right: 1rem;
		}
		/* Slippage: label on first line, pills on second line */
		.fees-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
			padding: 0.625rem 0.875rem;
		}
		.fees-header-right {
			width: 100%;
		}
		.slippage-options {
			width: 100%;
			justify-content: flex-start;
		}
	}
</style>
