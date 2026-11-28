<script lang="ts">
	import SwapFees from './SwapFees.svelte';
	import SwapAmountField from './SwapAmountField.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getAccountNameFromAddress, getUsernameFromAuth } from '$lib/getAccountName';
	import {
		getFee,
		getTxSessionId,
		optionsEqual,
		solveNetworkConstraints
	} from '$lib/sendswap/utils/sendUtils';
	import { useSwapState } from '$lib/sendswap/utils/txState.svelte';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import { onMount, untrack } from 'svelte';
	import swapOptions, {
		getFromOption,
		getToOption,
		Coin,
		Network,
		type CoinOnNetwork,
		type AssetOption,
		isSelectableSource,
		resolveSourceNetwork
	} from '$lib/sendswap/utils/sendOptions';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowDown, ArrowUpDown, ChevronRight, Search, Send, Wallet, X } from '@lucide/svelte';
	import { CoinAmount, formatUsd, formatUsdCost } from '$lib/currency/CoinAmount';
	import { usdPerUnit } from '$lib/currency/convert';
	import Dialog from '$lib/zag/Dialog.svelte';
	import {
		accountBalance,
		evmMinWithdrawal,
		evmProofFee,
		getBalanceSmallestUnits
	} from '$lib/stores/currentBalance';
	import { isEvmBridgeCoin } from '$lib/magiTransactions/evmBridge';
	import { isAddress } from 'viem';
	import { isEthAddress, magiRecipient } from '$lib/sendswap/utils/magiRecipient';
	import { btcSendFeeReserve, maxSendableSats } from '$lib/stores/btcSpendable';
	import type { AccountBalance } from '$lib/stores/currentBalance';
	import { EVM_BRIDGE_ENABLED, numberFormatLanguage } from '$lib/constants';
	import { getHiveAssetName, getHbdAssetName, vscNetworkId } from '$lib/../client';
	import {
		fetchTypedPoolDepths,
		buildSwapRoute,
		calculateRouteSwap,
		exceedsPoolDepthForRoute,
		priceImpactForRoute,
		swapFeeLabelPct,
		DEX_BASE_ASSET,
		type TypedPoolDepths,
		type SwapHop,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';
	import {
		fetchCustomTokens,
		customTokenCoin,
		CUSTOM_TOKEN_ICON,
		type CustomToken
	} from '$lib/tokens/customTokens';
	import { customTokenBalances, refreshCustomTokenBalances } from '$lib/tokens/customTokenBalances';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { browser } from '$app/environment';
	import {
		recipientHint,
		resolveDestNetwork,
		validateRecipient,
		type RecipientTarget
	} from '$lib/sendswap/utils/recipientValidation';
	import { isVscTestnet } from '../../../client';
	import {
		alteraFeePct,
		applyAlteraFeeBig,
		swapPaysAlteraFee
	} from '$lib/magiTransactions/hive/vscOperations/swap';
	import { ETH_NETWORK, ETH_PAYOUT_NOTE } from '$lib/sendswap/utils/ethNetworkCopy';
	import {
		ethPayoutGasLimit,
		fetchEvmPayoutGas,
		payoutArrival,
		type EvmPayoutGas
	} from '$lib/magiTransactions/eth/payoutFee';

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

	const txState = useSwapState();

	// Pool depths and swap calculation state
	let hiveHbdPool = $state.raw<TypedPoolDepths | null>(null);
	let btcHbdPool = $state.raw<TypedPoolDepths | null>(null);
	/** ETH/HBD and HBD/USDC when the EVM bridge is live: built-in assets routed
	 *  exactly like BTC/HBD (a pool that won't load just leaves its asset out). */
	let evmPools = $state.raw<TypedPoolDepths[]>([]);
	/** Pool-backed custom tokens, and the pools that back them. Each is paired
	 *  against HBD, so they slot straight into the same routing as the natives. */
	let customTokens = $state.raw<CustomToken[]>([]);
	let customPools = $state.raw<TypedPoolDepths[]>([]);
	/** True until the first full pool load settles. Lets the swap-calc effect
	 *  tell "pools still arriving" (show a spinner) apart from "this pair has
	 *  no route" (show nothing) — previously inferred from the two native
	 *  pools being null, which no longer covers custom pools. */
	let poolsLoading = $state(true);
	/** True when all pool-fetch retries have been exhausted without success. */
	let poolLoadFailed = $state(false);
	/** True while a retry round is in progress (disables the retry button). */
	let poolLoadingRetry = $state(false);

	// Resolve each swap-eligible pool dynamically so calls are
	// network-aware (mainnet vs testnet). Both are loaded in
	// parallel — the swap-calc effect picks whichever it needs
	// based on the user's selected pair.
	// Retries up to 3 times with exponential backoff if the
	// indexer/chain-state is momentarily unreachable.
	async function loadPoolsWithRetry(maxAttempts = 3) {
		if (poolLoadingRetry) return; // prevent concurrent retry cycles
		poolLoadFailed = false;
		poolLoadingRetry = true;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			const [hiveHbd, btcHbd, tokens, evm] = await Promise.all([
				hiveHbdPool ? null : fetchTypedPoolDepths('HIVE', 'HBD'),
				btcHbdPool ? null : fetchTypedPoolDepths('BTC', 'HBD'),
				customTokens.length ? customTokens : fetchCustomTokens(),
				EVM_BRIDGE_ENABLED && evmPools.length < 2
					? Promise.all([fetchTypedPoolDepths('ETH', 'HBD'), fetchTypedPoolDepths('HBD', 'USDC')])
					: null
			]);
			if (hiveHbd) hiveHbdPool = hiveHbd;
			if (btcHbd) btcHbdPool = btcHbd;
			// An empty pool has no reserves and no route: its asset stays off both lists.
			if (evm)
				evmPools = evm.filter(
					(d): d is TypedPoolDepths => d != null && d.reserve0 > 0n && d.reserve1 > 0n
				);
			customTokens = tokens;

			// Each custom token pairs against HBD. Load them alongside the
			// natives so routing has every pool it might need in hand; a token
			// whose pool won't load is dropped rather than offered as a dead
			// entry in the picker.
			if (tokens.length > 0) {
				const depths = await Promise.all(
					tokens.map((t) => fetchTypedPoolDepths(t.symbol, DEX_BASE_ASSET))
				);
				const loaded = depths.filter((d): d is TypedPoolDepths => d != null);
				customPools = loaded;
				const routable = new Set(loaded.flatMap((d) => [d.asset0, d.asset1]));
				customTokens = tokens.filter((t) => routable.has(t.symbol));
			}

			if (hiveHbdPool && btcHbdPool) {
				poolLoadingRetry = false;
				poolsLoading = false;
				return;
			}
			// Wait before retrying (1s, 2s, 4s)
			if (attempt < maxAttempts - 1) {
				await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
			}
		}
		poolLoadFailed = true;
		poolLoadingRetry = false;
		poolsLoading = false;
	}

	onMount(() => {
		loadPoolsWithRetry();
	});

	let swapResult: SwapCalcResult | null = $state(null);
	const DEFAULT_SLIPPAGE_BPS = 100; // 1%
	let slippageBps = $state(DEFAULT_SLIPPAGE_BPS);
	// Mirror slippage into the shared store regardless of pair. The
	// calculate-swap effect below only runs for HIVE↔HBD pairs, so for
	// BTC pairs (or any other route that doesn't have live pool math
	// in the frontend yet) this ensures the router still gets the
	// user's chosen tolerance when the tx is built.
	$effect(() => {
		if (txState.slippageBps !== slippageBps) {
			txState.slippageBps = slippageBps;
		}
	});

	/** Custom tokens exist only on Magi — there's no Hive-L1 or BTC-chain form
	 *  of one — so they carry a Magi-only network list. */
	const customAssetOptions = $derived<AssetOption[]>(
		customTokens.map((t) => ({ coin: customTokenCoin(t), networks: [Network.magi] }))
	);
	/** The static swap catalog extended with whatever tokens are live. Every
	 *  lookup in the picker goes through these, not `swapOptions` directly:
	 *  a custom token isn't in the static catalog, so a bare
	 *  `swapOptions.from.find(...)` returns undefined and the click does
	 *  nothing at all. */
	const fromOptions = $derived<AssetOption[]>([...swapOptions.from, ...customAssetOptions]);
	// ETH and USDC can also be paid out on Ethereum: the router withdraws the
	// output through the EVM bridge (destination_chain ETH, settleToEVM). Kept
	// local: the shared catalog drives the withdraw and transfer pages too.
	const toOptions = $derived<AssetOption[]>([
		...swapOptions.to.map((o) =>
			isEvmBridgeCoin(o.coin) ? { ...o, networks: [Network.magi, Network.ethMainnet] } : o
		),
		...customAssetOptions
	]);
	const findFromOption = (value: string | undefined) =>
		fromOptions.find((o) => o.coin.value === value);
	const findToOption = (value: string | undefined) => toOptions.find((o) => o.coin.value === value);

	/** Every pool the picker can route through, native and custom alike. */
	const allPools = $derived(
		[hiveHbdPool, btcHbdPool, ...evmPools, ...customPools].filter(
			(p): p is TypedPoolDepths => p != null
		)
	);

	/** Symbols this control can swap: the natives plus any pool-backed token. */
	const swapAssets = $derived(
		new Set([
			Coin.hive.value,
			Coin.hbd.value,
			Coin.btc.value,
			...evmPools.flatMap((p) => [p.asset0, p.asset1]),
			...customTokens.map((t) => t.symbol)
		])
	);

	/**
	 * The pools this pair routes through — one hop when they share a pool, two
	 * via HBD otherwise. Replaces the hand-written HIVE/HBD/BTC branch tree,
	 * which had no shape for a custom token's pool.
	 */
	const swapRoute = $derived.by<SwapHop[] | null>(() => {
		const from = txState.from?.coin.value;
		const to = txState.to?.coin.value;
		if (!from || !to) return null;
		const pools = allPools;
		return buildSwapRoute(
			from,
			to,
			(a, b) =>
				pools.find(
					(p) => (p.asset0 === a && p.asset1 === b) || (p.asset0 === b && p.asset1 === a)
				) ?? null
		);
	});

	// Recalculate swap whenever input amount, coins, or slippage changes.
	$effect(() => {
		const fromCoin = txState.from;
		const toCoin = txState.to;
		const fromAmount = txState.fromAmount;
		// Clear the prior fee-guard reading before recomputing; the success path
		// re-sets it. Without this a stale high feeBps from a previous quote could
		// wrongly block a now-different (or now-invalid) swap.
		untrack(() => {
			if (txState.swapFeeBps !== undefined) txState.swapFeeBps = undefined;
		});
		if (!fromCoin || !toCoin || !fromAmount || fromAmount === '0') {
			swapResult = null;
			txState.swapCalcPending = false;
			return;
		}

		const isSwap =
			swapAssets.has(fromCoin.coin.value) &&
			swapAssets.has(toCoin.coin.value) &&
			fromCoin.coin.value !== toCoin.coin.value;
		if (!isSwap) {
			swapResult = null;
			txState.swapCalcPending = false;
			return;
		}

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) {
			swapResult = null;
			txState.swapCalcPending = false;
			return;
		}

		const x = BigInt(fromAmountInt);
		const route = swapRoute;
		if (!route) {
			// No route yet. While pools are still arriving that's "not yet"
			// (keep the pending spinner); once loading has settled it means the
			// pair genuinely has no path through the DEX.
			swapResult = null;
			txState.swapCalcPending = poolsLoading;
			return;
		}

		// A resolved route always contains both of its hop assets, so this
		// always yields a quote — the old "no depths" early-return is
		// unreachable now that routing, not the caller, picks the pools.
		const result = calculateRouteSwap(x, route, slippageBps);
		swapResult = result;

		untrack(() => {
			txState.swapCalcPending = false;
			const expectedOutput = result.expectedOutput.toString();
			const minAmountOut = result.minAmountOut.toString();
			const swapBaseFee = result.baseFee.toString();
			const swapClpFee = result.clpFee.toString();
			const swapTotalFee = result.totalFee.toString();
			if (txState.expectedOutput !== expectedOutput) {
				txState.expectedOutput = expectedOutput;
			}
			if (txState.slippageBps !== slippageBps) {
				txState.slippageBps = slippageBps;
			}
			if (txState.minAmountOut !== minAmountOut) {
				txState.minAmountOut = minAmountOut;
			}
			if (txState.swapBaseFee !== swapBaseFee) {
				txState.swapBaseFee = swapBaseFee;
			}
			if (txState.swapClpFee !== swapClpFee) {
				txState.swapClpFee = swapClpFee;
			}
			if (txState.swapTotalFee !== swapTotalFee) {
				txState.swapTotalFee = swapTotalFee;
			}
			if (txState.swapFeeBps !== result.feeBps) {
				txState.swapFeeBps = result.feeBps;
			}
			const hop1 = result.hop1Fee
				? { asset: result.hop1Fee.asset, totalFee: result.hop1Fee.totalFee.toString() }
				: undefined;
			const prevHop1 = txState.swapHop1Fee;
			const hop1Changed = hop1
				? !prevHop1 || prevHop1.asset !== hop1.asset || prevHop1.totalFee !== hop1.totalFee
				: !!prevHop1;
			if (hop1Changed) {
				txState.swapHop1Fee = hop1;
			}

			// Display amount, so after the Altera fee like the rows below.
			const outputAmt = new CoinAmount(
				Number(applyAlteraFeeBig(result.expectedOutput)),
				toCoin.coin,
				true
			);
			const outputStr = outputAmt.toAmountString();
			if (txState.toAmount !== outputStr) {
				txState.toAmount = outputStr;
			}
		});
	});

	/** Smallest units as a short amount (no trailing zeros, at most 8 places):
	 *  0.15 USDC, 0.00005 ETH. */
	function shortUnits(raw: number, decimalPlaces: number): string {
		return (raw / 10 ** decimalPlaces).toLocaleString(numberFormatLanguage, {
			maximumFractionDigits: Math.min(decimalPlaces, 8)
		});
	}

	function formatSmallUnits(raw: bigint, decimalPlaces: number): string {
		const n = Number(raw) / 10 ** decimalPlaces;
		return n.toLocaleString(numberFormatLanguage, {
			useGrouping: true,
			minimumFractionDigits: decimalPlaces,
			maximumFractionDigits: decimalPlaces
		});
	}

	/**
	 * What the card SHOWS, after the Altera fee.
	 *
	 * The quote from `calculateRouteSwap` is pool math only. The transaction
	 * then scales `min_amount_out` down by the fee because the contract checks
	 * it AFTER the fee comes off — so the card used to promise 0.25% more
	 * output, and a higher floor, than the swap could actually pay (F1).
	 *
	 * `txState.minAmountOut` deliberately stays the PRE-fee number: the
	 * builders apply the reduction themselves, and doing it here as well would
	 * charge it twice.
	 */
	// `$derived.by` and not `$derived(...)`: at module level TS narrows
	// `swapResult` to the `null` it was initialised with — every reassignment
	// is inside a closure — so an inline ternary types the truthy branch as
	// `never`. A function body resets that narrowing, which is why the other
	// readers of `swapResult` here are all `.by` too.
	const shownExpectedOutput = $derived.by(() => {
		if (!swapResult) return 0n;
		return swapPaysAlteraFee()
			? applyAlteraFeeBig(swapResult.expectedOutput)
			: swapResult.expectedOutput;
	});
	const shownMinAmountOut = $derived.by(() => {
		if (!swapResult) return 0n;
		return swapPaysAlteraFee()
			? applyAlteraFeeBig(swapResult.minAmountOut)
			: swapResult.minAmountOut;
	});

	let expectedOutputUsd = $derived.by(() => {
		const toCoinDef = txState.to;
		if (!swapResult || swapResult.expectedOutput <= 0n || toPriceUsdRaw <= 0 || !toCoinDef)
			return null;
		return (Number(shownExpectedOutput) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
	});

	let minAmountOutUsd = $derived.by(() => {
		const toCoinDef = txState.to;
		if (!swapResult || swapResult.minAmountOut <= 0n || toPriceUsdRaw <= 0 || !toCoinDef)
			return null;
		return (Number(swapResult.minAmountOut) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
	});

	let inputAmountUsd = $derived.by(() => {
		const fromCoinDef = txState.from;
		const fromAmount = txState.fromAmount;
		if (!fromCoinDef || !fromAmount || fromAmount === '0' || fromPriceUsdRaw <= 0) return null;
		const amt = new CoinAmount(fromAmount, fromCoinDef.coin).toNumber();
		if (!Number.isFinite(amt) || amt <= 0) return null;
		return amt * fromPriceUsdRaw;
	});

	let exchangeFeePct = $derived(alteraFeePct());

	/**
	 * Total swap fee across all hops in USD: the protocol tier AND the slip
	 * fee, which is what the pool actually charges. It used to read `baseFee`,
	 * the protocol leg alone, so the slip leg was never shown — small while
	 * that leg was scaled to 1/16, but under THORChain's rule
	 * (`SLIP_FEE_RULE`) the slip fee is the larger of the two on any sizeable
	 * trade, and the label would have understated the cost by most of it.
	 * For two-hop routes (BTC↔HIVE), the intermediate hop fee is denominated in
	 * HBD (≈ $1 pegged). Final-hop fee is in the output coin.
	 */
	let totalSwapFeeUsd = $derived.by(() => {
		const toCoinDef = txState.to;
		if (!swapResult || toPriceUsdRaw <= 0 || !toCoinDef) return null;
		const finalHopUsd =
			(Number(swapResult.totalFee) / 10 ** toCoinDef.coin.decimalPlaces) * toPriceUsdRaw;
		if (!swapResult.hop1Fee) return finalHopUsd;
		// hop1 intermediate is always HBD for BTC↔HIVE routes; HBD ≈ $1 pegged
		const hop1Usd = Number(swapResult.hop1Fee.totalFee) / 10 ** Coin.hbd.decimalPlaces;
		return hop1Usd + finalHopUsd;
	});

	/** The modelled effective rate for the fee label (both hops summed). */
	let swapFeePct = $derived.by(() => swapFeeLabelPct(swapResult?.feeBps));

	const auth = $derived(getAuth()());

	// Custom-token balances live outside the native balance poller, so refresh
	// them here — and on every account switch, or the picker would keep showing
	// the previous account's holdings.
	$effect(() => {
		const did = auth.value?.did;
		if (!did) return;
		refreshCustomTokenBalances(did);
	});

	// ── Destination state (from SwapDestination) ──
	const DEST_NETWORK_KEY = 'swap-dest-network';
	const ADVANCED_KEY = 'swap-advanced';
	const isMainnet = vscNetworkId === 'vsc-mainnet';
	const chainLabel = isMainnet ? 'Mainnet' : 'Testnet';

	/**
	 * The redesign's "Advanced" switch, off for a first-time visitor.
	 *
	 * It gates the two expert controls the handoff names: the slippage chips
	 * and the Deliver-to panel. Turning it back off resets BOTH to their
	 * defaults — not just Deliver-to, as the spec says, because a slippage
	 * the user raised and can no longer see is a setting acting on their swap
	 * behind their back.
	 *
	 * The switch itself persists (same pattern as `DEST_NETWORK_KEY` below):
	 * someone who works in Advanced was re-hiding their own controls on every
	 * reload. What it reveals does NOT persist — slippage and the destination
	 * still come back at their defaults, so a stored preference can only ever
	 * show you more, never apply a setting you can't see.
	 */
	function getStoredAdvanced(): boolean {
		if (!browser) return false;
		return localStorage.getItem(ADVANCED_KEY) === '1';
	}
	let advanced = $state(getStoredAdvanced());

	let destChoice: 'wallet' | 'address' = $state('wallet');

	/** True when the selected TO asset exists only on Magi — i.e. a custom
	 *  token. There is no mainnet form of it to settle to, so the address
	 *  destination is disabled for these. */
	const toIsMagiOnly = $derived.by(() => {
		const opt = findToOption(txState.to?.coin.value);
		if (!opt) return false;
		return !opt.networks.some((n) => n.value !== Network.magi.value);
	});

	// Switching the target to a Magi-only asset while "Send to address" is
	// selected would strand the user on a now-disabled option, so fall back to
	// the wallet destination.
	$effect(() => {
		if (toIsMagiOnly && destChoice === 'address') destChoice = 'wallet';
	});

	/** Leaving Advanced returns the controls it hides to their defaults, so
	 *  nothing it set keeps applying out of sight. */
	function setAdvanced(on: boolean) {
		advanced = on;
		// Written here, not in an `$effect`, because this is the only place
		// `advanced` changes — an effect would also write it back on mount.
		if (browser) localStorage.setItem(ADVANCED_KEY, on ? '1' : '0');
		if (on) return;
		destChoice = 'wallet';
		destAddress = '';
		destNetworkChoice = 'mainnet';
		slippageBps = DEFAULT_SLIPPAGE_BPS;
	}

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

	/**
	 * Where the output settles.
	 *
	 * `destChoice` decides WHO is paid — the signed-in account or a typed
	 * address — and `destNetworkChoice` decides WHERE. The two are orthogonal,
	 * which the old code could not express: its wallet branch pinned
	 * `Network.magi`, so paying yourself always meant staying on Magi and the
	 * normal swap defaulted to a Magi-to-Magi trade. The owner's rule (M9) is
	 * that the normal swap is mainnet-to-mainnet and the Magi options are
	 * expert controls, so both destinations now read the same network choice.
	 *
	 * A Magi-only asset — a custom token, sHBD — has no mainnet form to settle
	 * to, so it resolves to Magi whatever is selected, and the mainnet button
	 * is disabled rather than silently ignored. `destNetworkChoice` itself is
	 * left alone in that case: overwriting it would persist "magi" and every
	 * later session would open on the wrong default.
	 */
	const destResolution = $derived(
		resolveDestNetwork({
			toCoin: txState.to?.coin.value,
			choice: destNetworkChoice === 'magi' ? 'magi' : 'mainnet',
			recipient: destChoice,
			did: auth.value?.did,
			provider: auth.value?.provider
		})
	);
	const destNetwork = $derived(destResolution.network);

	/** The blocked reason as a sentence, or `undefined` when mainnet is open. */
	const mainnetDestBlocked = $derived.by(() => {
		switch (destResolution.blocked) {
			case 'magi-only-asset':
				return `${coinDisplayLabel(toCoin)} only exists on the Magi network.`;
			case 'wallet-cannot-receive':
				return `Your connected wallet cannot receive ${coinDisplayLabel(toCoin)} on ${chainLabel}. Choose "Pay someone else" and enter an address, or keep it on Magi.`;
			default:
				return undefined;
		}
	});

	$effect(() => {
		if (txState.to && txState.to.network.value !== destNetwork.value) {
			txState.to = { coin: txState.to.coin, network: destNetwork };
		}
	});

	/**
	 * `toUsername` is the router's recipient, so it must always say who is
	 * actually being paid — the typed address, or the signed-in account.
	 *
	 * It used to be written only while "Send to address" held text, and never
	 * cleared. Switching back to "Keep on Magi", or turning Advanced off,
	 * emptied the BOX but left the address in state. Nothing on Magi read it,
	 * so it was invisible — until the bad flip state turned the swap into a
	 * plain transfer and sent the money there (H1), while the Review screen
	 * printed it as the receiver all along (M1).
	 *
	 * Now that M1 pays `toUsername` on Magi too, a stale value would be paid
	 * rather than ignored, so the reset is what makes that safe.
	 */
	$effect(() => {
		const own = getUsernameFromAuth(auth);
		if (destChoice === 'address' && destAddress.trim()) {
			txState.toUsername = destAddress.trim();
		} else if (own) {
			txState.toUsername = own;
		}
	});

	// ── Combined editStage: swap fields valid AND destination valid ──
	let swapFieldsValid = $state(false);
	$effect(() => {
		const valid = !!(
			txState.to &&
			txState.toAmount &&
			txState.toAmount !== '0' &&
			txState.from &&
			txState.fromAmount &&
			txState.fromAmount !== '0'
		);
		swapFieldsValid = valid;
		untrack(() => {
			if (valid) {
				getFee(txState.toAmount, txState).then((fee) => {
					if (fee?.amount !== txState.fee?.amount || fee?.coin.value !== txState.fee?.coin.value)
						txState.fee = fee;
				});
			}
		});
	});

	// Destination valid check. When the target coin is BTC AND the
	// user picked "Send to address" on a mainnet settlement, the
	// entered address must parse as a Bitcoin address on the right
	// network. Non-BTC targets only require a non-empty string.
	/**
	 * Where the output actually lands, which is what decides the address
	 * format the recipient field must accept.
	 */
	const recipientTarget = $derived.by<RecipientTarget>(() => {
		if (destNetwork.value === Network.magi.value) return 'magi';
		if (destNetwork.value === Network.ethMainnet.value) return 'eth';
		return txState.to?.coin.value === Coin.btc.value ? 'btc' : 'hive';
	});

	/**
	 * Re-checked on every asset and network change, not just on submit: the
	 * target moves under an address typed for a different one (a BTC address
	 * left behind when the output switches to HIVE).
	 *
	 * Only BTC-on-mainnet used to be checked, and silently — the Review
	 * button just stayed disabled with nothing saying why. A Hive payout took
	 * any non-empty string, and a malformed name reverts the whole router
	 * transaction on chain and spends the RC for nothing.
	 */
	const destCheck = $derived(
		destChoice === 'wallet'
			? ({ ok: true } as const)
			: validateRecipient(destAddress, recipientTarget, { testnet: isVscTestnet() })
	);
	/**
	 * Does the typed Hive account actually exist?
	 *
	 * The regex only proves the NAME is well formed. Paying one that does not
	 * exist reverts the whole router call on chain — no funds lost, but the RC
	 * is spent and the card said nothing was wrong (M2). The BTC deposit-swap
	 * path has checked this since #168; the swap card never did, so it uses
	 * the same `hiveAccountExists`.
	 *
	 * Keyed by the name it describes, so a result from an earlier keystroke
	 * can never be read as a verdict on the current one.
	 */
	let hiveNameCheck = $state<
		{ name: string; state: 'checking' | 'missing' | 'present' | 'unreachable' } | undefined
	>();

	$effect(() => {
		const raw = destAddress.trim();
		const needed = destChoice === 'address' && recipientTarget === 'hive' && destCheck.ok && !!raw;
		if (!needed) {
			hiveNameCheck = undefined;
			return;
		}
		const name = raw;
		hiveNameCheck = { name, state: 'checking' };
		// Debounced: this is a network call per keystroke otherwise.
		const timer = setTimeout(async () => {
			let next: 'missing' | 'present' | 'unreachable';
			try {
				const { hiveAccountExists } = await import('$lib/magiTransactions/bitcoin/swapDeposit');
				next = (await hiveAccountExists(name)) ? 'present' : 'missing';
			} catch {
				next = 'unreachable';
			}
			// Still the name we were asked about?
			if (untrack(() => hiveNameCheck?.name) === name) hiveNameCheck = { name, state: next };
		}, 450);
		return () => clearTimeout(timer);
	});

	const destValid = $derived(destCheck.ok && (!hiveNameCheck || hiveNameCheck.state === 'present'));
	/** Shown only once something has been typed, so an untouched field is not
	 *  scolded for being empty. */
	const destError = $derived.by(() => {
		if (!destCheck.ok) return destAddress.trim() ? destCheck.reason : undefined;
		switch (hiveNameCheck?.state) {
			case 'missing':
				return `There is no Hive account ${hiveNameCheck.name.replace(/^hive:/, '').replace(/^@/, '')}.`;
			case 'unreachable':
				return 'Could not check that Hive account. Try again.';
			default:
				return undefined;
		}
	});

	/**
	 * Why the typed receiver cannot be paid, for a swap kept on Magi or paid
	 * on Hive (null when it can). Strict (magiRecipient): a mistyped 0x
	 * checksum would re-checksum to an address nobody owns, "@bob" or an
	 * unknown string used to fail on chain or quietly pay the sender.
	 */
	const recipientError = $derived.by<string | null>(() => {
		if (destChoice !== 'address') return null;
		const addr = destAddress.trim();
		if (!addr) return null;
		const to = txState.to;
		if (!to) return null;
		if (destNetworkChoice === 'magi') {
			const r = magiRecipient(addr, isVscTestnet());
			return r.ok ? null : r.error;
		}
		if (to.network.value === Network.hiveMainnet.value) {
			const r = magiRecipient(addr, isVscTestnet());
			return r.ok && r.did.startsWith('hive:') ? null : 'Enter a Hive account to receive on Hive.';
		}
		return null;
	});

	/**
	 * A swap paid out on Ethereum: the router withdraws the output less the
	 * bridge's proof fee (dex-router settleToEVM), and the bridge takes the
	 * Ethereum gas out of what it sends. Below the bridge's minimum withdrawal
	 * the whole swap fails on chain, so it is stopped here.
	 */
	const evmPayout = $derived.by(() => {
		const to = txState.to;
		if (!to || !isEvmBridgeCoin(to.coin) || to.network.value !== Network.ethMainnet.value)
			return null;
		const isUsdc = to.coin.value === Coin.usdc.value;
		const proofFee = isUsdc ? $evmProofFee.usdc : $evmProofFee.eth;
		const min = isUsdc ? $evmMinWithdrawal.usdc : $evmMinWithdrawal.eth;
		const minOut = swapResult ? Number(swapResult.minAmountOut) : null;
		return {
			coin: to.coin,
			proofFee,
			min,
			minOut,
			// Unknown minimum (registry not read yet) blocks rather than guesses.
			belowMin: min == null || (minOut != null && minOut - proofFee < min)
		};
	});
	// Only the payout's coin drives the fee effects below (the quote object is
	// rebuilt on every price tick; reading it would re-run them each time).
	const payoutCoinValue = $derived(evmPayout?.coin.value ?? null);
	// The gas limit an ETH payout will carry (its recipient's estimate + 20%,
	// as sent at signing), so the gas shown is priced as the bridge charges it.
	let payoutGasLimitEst: number | null = $state(null);
	$effect(() => {
		const did = auth.value?.did;
		const to = destAddress?.trim() ?? '';
		const isEth = payoutCoinValue === Coin.eth.value;
		payoutGasLimitEst = null;
		if (!did || !isEth || !/^0x[0-9a-fA-F]{40}$/.test(to)) return;
		let live = true;
		const t = setTimeout(() => {
			const value = BigInt(untrack(() => evmPayout?.minOut) || 1);
			ethPayoutGasLimit(did, to, value).then((g) => {
				if (live) payoutGasLimitEst = g;
			});
		}, 600);
		return () => {
			live = false;
			clearTimeout(t);
		};
	});
	// The Ethereum gas the bridge takes from the payout now (payoutFee.ts).
	let payoutGas: EvmPayoutGas = $state({ status: 'unknown' });
	$effect(() => {
		const coin = payoutCoinValue;
		const did = auth.value?.did;
		const gasLimit = coin === Coin.eth.value ? payoutGasLimitEst : null;
		if (!coin || !did) return;
		let live = true;
		const load = () =>
			fetchEvmPayoutGas(did, coin, gasLimit).then((g) => {
				if (live) payoutGas = g;
			});
		load();
		const timer = setInterval(load, 30_000);
		return () => {
			live = false;
			clearInterval(timer);
		};
	});
	const payoutLine = $derived(
		evmPayout?.minOut != null
			? payoutArrival(evmPayout.minOut, evmPayout.proofFee, payoutGas)
			: null
	);

	/**
	 * True when the input amount exceeds 50% of the relevant pool's input-side
	 * reserve. The contract hard-caps swaps at this threshold; any transaction
	 * beyond it will be rejected on-chain, so we block submission here.
	 * For two-hop routes we check both pools: the direct input vs pool1, and
	 * the estimated intermediate amount vs pool2's input reserve.
	 */
	let exceedsPoolDepth = $derived.by(() => {
		const fromCoin = txState.from;
		const toCoin = txState.to;
		const fromAmount = txState.fromAmount;
		if (!fromCoin || !toCoin || !fromAmount || fromAmount === '0') return false;

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) return false;

		return exceedsPoolDepthForRoute(BigInt(fromAmountInt), swapRoute);
	});

	// Combined: enable button when swap fields valid, destination valid, not same coin, has balance,
	// and pool-based swap calc has completed (swapResult non-null). Without swapResult the fee
	// details aren't available and the tx would be built with stale/missing min_amount_out.
	$effect(() => {
		if (!isActive) return;
		editStage(
			swapFieldsValid &&
				destValid &&
				!sameCoinError &&
				!insufficientBalance &&
				!exceedsPoolDepth &&
				!evmPayout?.belowMin &&
				!!swapResult
		);
	});

	let { assetOptions, networkOptions } = $state<ReturnType<typeof solveNetworkConstraints>>({
		assetOptions: [],
		networkOptions: []
	});
	$effect(() => {
		const { assetOptions: newAssetOptions, networkOptions: newNetworkOptions } =
			solveNetworkConstraints(
				txState.rail,
				getFromOption(txState.from?.coin.value),
				txState.to?.network,
				auth.value?.did,
				txState.from?.network,
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
		if (!txState.from && assetOptions.length > 0) {
			const btcOption = assetOptions.find(
				(opt) => opt.coin.value === Coin.btc.value && !opt.disabled
			);
			const firstAvailable = assetOptions.find((opt) => !opt.disabled);
			const fromOpt = btcOption ?? firstAvailable;
			if (fromOpt) {
				txState.from = { coin: fromOpt.coin, network: Network.magi };
			}
		}

		// TO auto selection, update only if value changes!
		const visibleToObjs = toAssetObjs.filter((obj) => {
			const coinDef = Object.values(Coin).find((c) => c.value === obj.value);
			if (!coinDef) return false;
			const bal = getBalanceSmallestUnits($accountBalance, coinDef, Network.magi);
			return bal > 0.001;
		});
		if (!txState.to) {
			let nextToCoin: (typeof swapOptions.to)[number] | undefined;
			let nextToNetwork: Network | undefined;
			if (visibleToObjs.length > 0) {
				const hiveTo = visibleToObjs.find((obj) => obj.value === Coin.hive.value);
				const firstAvailableTo = visibleToObjs[0];
				if (hiveTo) {
					const swapTo = getToOption(Coin.hive.value);
					if (swapTo) {
						nextToCoin = swapTo;
						nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
					}
				} else if (firstAvailableTo) {
					const swapTo = getToOption(firstAvailableTo.value);
					if (swapTo) {
						nextToCoin = swapTo;
						nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
					}
				}
			} else {
				nextToCoin = undefined;
				nextToNetwork = undefined;
			}
			// Block only entered when `to` is undefined, so the previous-value
			// comparison from the legacy code is no-op here — just set when we
			// have a complete next pair.
			if (nextToCoin && nextToNetwork) {
				txState.to = { coin: nextToCoin.coin, network: nextToNetwork };
			}
		}
	});

	// Same-coin error: show when from and to are the same asset
	let sameCoinError = $derived(
		txState.from && txState.to ? txState.from.coin.value === txState.to.coin.value : false
	);

	// Insufficient balance: check if from amount exceeds available balance.
	// Custom tokens aren't in `accountBalance` (a fixed struct of native
	// assets), so read them from their own store — the same source as
	// `maxAmount` and the "Balance:" line. Reading `accountBalance` for them
	// always gave 0, which blocked every swap FROM a custom token.
	let insufficientBalance = $derived.by(() => {
		const from = txState.from;
		const fromAmount = txState.fromAmount;
		if (!from || !fromAmount || fromAmount === '0') return false;
		const bal = customTokens.some((t) => t.symbol === from.coin.value)
			? ($customTokenBalances.bal[from.coin.value] ?? 0)
			: getBalanceSmallestUnits($accountBalance, from.coin, from.network);
		if (bal <= 0) return true;
		const sendable =
			from.coin.value === Coin.btc.value && from.network.value === Network.btcMainnet.value
				? maxSendableSats(bal, $btcSendFeeReserve)
				: bal;
		const inputNum = new CoinAmount(fromAmount, from.coin).toNumber();
		const balNum = new CoinAmount(sendable, from.coin, true).toNumber();
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
		},
		// ETH and USDC held on Magi, once their pool has loaded (as the To list
		// already offers them). send() approves the router on the EVM bridge
		// first, the way it approves BTC on the BTC contract.
		...[Coin.eth, Coin.usdc]
			.filter((coin) => swapAssets.has(coin.value))
			.map((coin) => ({
				...coin,
				snippet: assetCard,
				snippetData: {
					fromOpt: { coin, networks: [Network.magi] },
					net: Network.magi,
					size: 'medium'
				}
			}))
	]);
	const toAssetObjs: AssetObject[] = $derived(
		swapOptions.to
			// ETH/USDC only once their pool has loaded, as on the From side: an
			// empty pool has no route and the swap could not be quoted.
			.filter((opt) => !isEvmBridgeCoin(opt.coin) || swapAssets.has(opt.coin.value))
			.map((opt) => ({
				...opt.coin,
				snippet: assetCard,
				snippetData: { fromOpt: opt, net: txState.to?.network, size: 'medium' }
			}))
	);

	/** Custom tokens as picker entries. These are NOT shown in the top-level
	 *  chip row — a single "Custom" chip stands in for the whole category and
	 *  drills into this list, so the row stays short as tokens are added. */
	const customAssetObjs: AssetObject[] = $derived(
		customAssetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: Network.magi, size: 'medium' }
		}))
	);

	/** The custom token currently sitting in the from/to slot, if any. The
	 *  category chip renders as that token so the row still reflects the real
	 *  selection instead of a generic "Custom" while LASSECASH is picked. */
	const activeCustomObj = $derived(
		customAssetObjs.find(
			(o) => o.value === txState.from?.coin.value || o.value === txState.to?.coin.value
		)
	);

	// Only the from coin for the amount input – no dropdown; from is changed only via the left card.
	let amountInputCoinOpts: CoinOnNetwork[] = $derived(txState.from ? [txState.from] : []);

	let inputAmount = $state(new CoinAmount(0, Coin.unk));
	$effect(() => {
		if (!txState.from) return;
		if (inputAmount.coin.value === txState.from.coin.value) {
			const amt = inputAmount.toAmountString();
			if (amt !== txState.fromAmount) txState.fromAmount = amt;
		} else {
			inputAmount.convertTo(txState.from.coin, Network.lightning).then((amt) => {
				if (txState.fromAmount !== amt.toAmountString()) {
					txState.fromAmount = amt.toAmountString();
				}
			});
		}
	});

	$effect(() => {
		if (!txState.to) return;
		// When pool-based swap calc is active, it sets toAmount directly
		// (even when expectedOutput is 0 — e.g. amount exceeds pool reserves)
		if (swapResult) return;
		if (inputAmount.coin.value === txState.to.coin.value) {
			const amt = inputAmount.toAmountString();
			if (amt !== txState.toAmount) txState.toAmount = amt;
		} else {
			inputAmount.convertTo(txState.to.coin, Network.lightning).then((amt) => {
				// Discard stale exchange-rate estimate if pool calc resolved while we waited
				if (swapResult) return;
				if (txState.toAmount !== amt.toAmountString()) {
					txState.toAmount = amt.toAmountString();
				}
			});
		}
	});

	// TO field — derives a CoinAmount from the calculated toAmount for the AmountInput.
	// Currently read-only (disabled); will become editable when reverse swap calc is added.
	const outputAmount = $derived.by(() => {
		const toCoin = txState.to?.coin ?? Coin.unk;
		const raw = txState.toAmount;
		const fromEmpty = !txState.fromAmount || txState.fromAmount === '0';
		if (raw && raw !== '0' && !fromEmpty) return new CoinAmount(raw, toCoin);
		return new CoinAmount(0, toCoin);
	});
	const toAmountCoinOpts: CoinOnNetwork[] = $derived(txState.to ? [txState.to] : []);

	let fromPriceUsdRaw = $state(0);
	let toPriceUsdRaw = $state(0);
	let pricesFailed = $state(false);
	// Unrounded per-unit prices: a 1-unit CoinAmount converted to USD rounds to
	// whole cents, so a custom token (LASSECASH ≈ $0.0007) read $0 and its
	// "≈ $" line never showed.
	$effect(() => {
		if (txState.from) {
			usdPerUnit(txState.from.coin)
				.then((usd) => {
					fromPriceUsdRaw = usd;
					pricesFailed = false;
				})
				.catch(() => {
					pricesFailed = true;
				});
		}
		if (txState.to) {
			usdPerUnit(txState.to.coin)
				.then((usd) => {
					toPriceUsdRaw = usd;
					pricesFailed = false;
				})
				.catch(() => {
					pricesFailed = true;
				});
		}
	});

	let minAmount: CoinAmount<Coin> | undefined = $state();
	$effect(() => {
		const amt =
			txState.from?.coin.value === Coin.btc.value
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
	/**
	 * The balance of the source asset, or `undefined` when it is not KNOWN
	 * yet — the two were conflated, so a zero balance hid both the "Balance:"
	 * line and the Max button and the card showed no numbers at all (L5).
	 * Zero is an answer; only an unloaded balance is not.
	 *
	 * `maxSendable` below is what the Max button uses, and it still goes
	 * `undefined` when a BTC balance cannot cover its own miner fee.
	 */
	const maxAmount: CoinAmount<Coin> | undefined = $derived.by(() => {
		const from = txState.from;
		if (!from) return undefined;
		const coinValue = from.coin.value;
		// BTC on Bitcoin is the wallet's on-chain balance (connectedBal), as for
		// Hive L1; reading the Magi-mapped balance here showed one balance and
		// checked another (insufficientBalance reads the wallet).
		if (
			from.network.value === Network.hiveMainnet.value ||
			from.network.value === Network.btcMainnet.value
		) {
			const connected = $accountBalance.connectedBal;
			if (!connected) return undefined;
			const bal = connected[coinValue as keyof typeof connected];
			if (bal == null || typeof bal !== 'number') return undefined;
			return new CoinAmount(Math.max(0, bal), from.coin, true);
		}
		// Custom tokens aren't in `accountBalance` — it's a fixed struct of
		// native assets — so swapping FROM one would otherwise show no balance
		// and no Max.
		if (customTokens.some((t) => t.symbol === coinValue)) {
			const raw = $customTokenBalances.bal[coinValue] ?? 0;
			return new CoinAmount(Math.max(0, raw), from.coin, true);
		}
		const key = coinValue as keyof AccountBalance;
		const bal = $accountBalance.bal?.[key];
		if (bal == null || typeof bal !== 'number') return undefined;
		return new CoinAmount(Math.max(0, bal), from.coin, true);
	});

	// A BTC send from the wallet must leave room for its miner fee: asking the
	// wallet for the whole balance fails there (Leather: InsufficientFunds).
	const paysBitcoinFee = $derived(
		txState.from?.coin.value === Coin.btc.value &&
			txState.from?.network.value === Network.btcMainnet.value
	);
	const maxSendable = $derived.by(() => {
		if (!maxAmount || !paysBitcoinFee) return maxAmount;
		const sats = maxSendableSats(maxAmount.amount, $btcSendFeeReserve);
		return sats > 0 ? new CoinAmount(sats, maxAmount.coin, true) : undefined;
	});

	/**
	 * Why "Review swap" is disabled, when nothing else on screen says so.
	 *
	 * The button just greyed out and the reader had to guess which of six
	 * gates was unmet (L4). The three that already render their own inline
	 * error — same coin, insufficient balance, pool depth — return
	 * `undefined` here on purpose: the card should gain a reason, not a
	 * second copy of one it already gave. That is also why this is not simply
	 * a list of every failing condition.
	 */
	const reviewBlocker = $derived.by(() => {
		if (!txState.from || !txState.to) return 'Pick the asset to pay with and the one to receive.';
		if (!txState.fromAmount || txState.fromAmount === '0') return 'Enter an amount to swap.';
		// Already explained inline, on the field that caused it.
		if (sameCoinError || insufficientBalance || exceedsPoolDepth) return undefined;
		if (destChoice === 'address' && !destAddress.trim()) {
			return 'Enter the address the output should go to.';
		}
		// The existence check disables Review for a moment with nothing to show
		// for it, so it says so rather than looking stuck.
		if (hiveNameCheck?.state === 'checking') return 'Checking that Hive account…';
		if (!destValid) return undefined; // `destError` states the rule it broke.
		if (!swapResult) return 'Fetching a price for this pair…';
		return undefined;
	});

	/**
	 * Who gets paid, in one line, always on screen (M2).
	 *
	 * Every destination control lives under Advanced, which is off on a first
	 * visit — so the card never said who the output was going to, and the
	 * answer was not even constant: it depends on the login and on whether an
	 * address was typed earlier. Showing it is also what makes the stale
	 * `toUsername` class of bug visible instead of silent.
	 */
	const recipientSummary = $derived.by(() => {
		const where = destNetwork.value === Network.magi.value ? 'Magi' : chainLabel;
		const typed = destAddress.trim();
		if (destChoice === 'address' && typed) {
			return { who: getAccountNameFromAddress(typed), where, mine: false };
		}
		const own = getUsernameFromAuth(auth);
		return {
			who: own ? getAccountNameFromAddress(own) : 'your wallet',
			where,
			mine: true
		};
	});

	let dialogOpen = $state(false);
	let toggle = $state<(open?: boolean) => void>(() => {});
	let currentlyOpen: 'from' | 'to' = $state('from');

	// ── Multi-step dialog state ──
	// 'custom' is a drill-in from the Custom chip: custom tokens are NOT listed
	// alongside the native ones, they live one level down behind that chip.
	let dialogStep = $state<'tokens' | 'custom' | 'source'>('tokens');
	/** Which list the 'source' step was reached from, so Back returns there
	 *  rather than always dumping the user back on the top-level chips. */
	let sourceReturnStep = $state<'tokens' | 'custom'>('tokens');
	const dialogBack = $derived(
		dialogStep === 'source'
			? () => {
					dialogStep = sourceReturnStep;
					tempCoinOpt = undefined;
				}
			: dialogStep === 'custom'
				? () => {
						dialogStep = 'tokens';
						tokenSearch = '';
					}
				: undefined
	);
	let tempCoinOpt: AssetOption | undefined = $state();
	let tokenSearch = $state('');

	function openDialog(state: 'from' | 'to') {
		currentlyOpen = state;
		dialogStep = 'tokens';
		sourceReturnStep = 'tokens';
		tokenSearch = '';
		tempCoinOpt = undefined;
		toggle(true);
	}

	/** Open the custom-token list. The search box is shared across steps, so
	 *  clear it — a query typed against the native chips shouldn't silently
	 *  filter the list the user just drilled into. */
	function openCustomStep() {
		tokenSearch = '';
		dialogStep = 'custom';
	}

	function closeDialog() {
		toggle(false);
		dialogStep = 'tokens';
		sourceReturnStep = 'tokens';
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
		// Custom tokens aren't in the `Coin` catalog and their balances aren't in
		// `accountBalance` (which is a fixed struct of native assets) — they come
		// from the indexer's per-contract rows instead.
		const customToken = customTokens.find((t) => t.symbol === coinValue);
		if (customToken) {
			if (networkValue !== Network.magi.value) return '0';
			const raw = $customTokenBalances.bal[coinValue] ?? 0;
			if (raw <= 0) return '0';
			return new CoinAmount(raw, customTokenCoin(customToken), true).toPrettyAmountString();
		}

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

	/**
	 * Swap FROM ↔ TO via the arrow button.
	 * Only tokens swap — FROM gets the old TO token and keeps its own
	 * network source (user must re-pick via the dialog if they want a
	 * different source). TO network is owned by the destChoice effect.
	 */
	function swapPositions() {
		if (!txState.from || !txState.to) return;
		const prevFromCoin = txState.from.coin;
		const prevFromNet = txState.from.network;
		const prevToCoin = txState.to.coin;
		// Tokens swap; FROM keeps its source network ONLY IF the incoming coin
		// can be on it. It used to keep it unconditionally, which turned
		// BTC/Bitcoin -> HIVE into "HIVE on the Bitcoin network" — a pair
		// `send()` cannot classify as a swap, so Review signed a plain BTC
		// transfer instead (H1). TO network is managed by the destChoice
		// $effect — don't set it here (preserve it).
		txState.from = {
			coin: prevToCoin,
			network: resolveSourceNetwork(prevToCoin.value, prevFromNet.value)
		};
		txState.to = { coin: prevFromCoin, network: txState.to.network };
	}

	const canSwapPositions = $derived(!!(txState.from && txState.to));

	/**
	 * The networks the source step offers, which is also what the step-skipping
	 * count is computed from, so the two cannot drift apart.
	 *
	 * Filtered through `isSelectableSource`, not just "not Lightning": BTC is
	 * listed on Bitcoin in `swapOptions.from` for the deposit and withdraw
	 * flows, but a swap cannot start there, and offering the card meant the
	 * user only found out at Review — before the gate existed, it signed a
	 * plain transfer of the output asset instead.
	 */
	function selectableNetworks(opt: AssetOption): Network[] {
		return opt.networks.filter((n) => isSelectableSource(opt.coin.value, n.value));
	}

	/**
	 * Move to the network step, or skip it when there's nothing to choose.
	 * A custom token only exists on Magi, so that step would render a single
	 * card the user has to click to proceed — pure friction. Keyed on the
	 * network count rather than "is this custom", so a token that ever gains a
	 * second network gets the picker back automatically.
	 */
	function pickSourceNetwork(coinOpt: AssetOption, cameFrom: 'tokens' | 'custom') {
		const nets = selectableNetworks(coinOpt);
		if (nets.length === 1) {
			confirmFromSelection(coinOpt, nets[0]);
			return;
		}
		tempCoinOpt = coinOpt;
		sourceReturnStep = cameFrom;
		dialogStep = 'source';
	}

	function selectToken(token: AssetObject) {
		// Remember the list this pick came from, so Back out of the network step
		// returns to the custom list rather than the top-level chips.
		const cameFrom: 'tokens' | 'custom' = dialogStep === 'custom' ? 'custom' : 'tokens';

		// If the user picks the token already in the OTHER slot, swap tokens.
		const otherValue = currentlyOpen === 'from' ? txState.to?.coin.value : txState.from?.coin.value;

		if (otherValue && token.value === otherValue) {
			if (currentlyOpen === 'from') {
				// User is picking FROM and clicked the current TO token.
				// Move old FROM → TO (keep TO network), show network picker for new FROM.
				if (txState.from && txState.to) {
					txState.to = { coin: txState.from.coin, network: txState.to.network };
				}
				const coinOpt = findFromOption(token.value);
				if (!coinOpt) return;
				pickSourceNetwork(coinOpt, cameFrom);
			} else {
				// User is picking TO and clicked the current FROM token.
				// Swap tokens: old FROM ↔ old TO (each keeps its own network).
				if (txState.from && txState.to) {
					const prevFromCoin = txState.from.coin;
					const prevToCoin = txState.to.coin;
					txState.to = { coin: prevFromCoin, network: txState.to.network };
					// Resolve, don't inherit: handing the new source coin the old
					// one's network is how H1 built "HIVE on the Bitcoin network".
					// The flip above was fixed; this shortcut was missed, and M9
					// made it reachable by making Hive L1 the normal source.
					txState.from = {
						coin: prevToCoin,
						network: resolveSourceNetwork(prevToCoin.value, txState.from.network.value)
					};
				}
				closeDialog();
			}
			return;
		}

		const source = currentlyOpen === 'from' ? fromOptions : toOptions;
		const coinOpt = source.find((opt) => opt.coin.value === token.value);
		if (!coinOpt) return;
		tempCoinOpt = coinOpt;

		if (currentlyOpen === 'from') {
			// Show balance sources for the selected token — unless there's only
			// one, in which case take it and close.
			pickSourceNetwork(coinOpt, cameFrom);
		} else {
			// To selection: always use Magi network
			confirmToSelection(coinOpt, Network.magi);
		}
	}

	function confirmFromSelection(coinOpt: AssetOption, network: Network) {
		txState.from = { coin: coinOpt.coin, network };
		closeDialog();
	}

	function confirmToSelection(coinOpt: AssetOption, network: Network) {
		txState.to = { coin: coinOpt.coin, network };
		closeDialog();
	}

	function coinDisplayLabel(coin: (typeof Coin)[keyof typeof Coin]): string {
		return coin.value === Coin.hive.value
			? getHiveAssetName()
			: coin.value === Coin.hbd.value
				? getHbdAssetName()
				: coin.label;
	}

	let toCoin = $derived(txState.to?.coin ?? Coin.unk);

	let priceImpactPct = $derived.by(() => {
		const fromCoinDef = txState.from;
		const toCoinDef = txState.to;
		const fromAmount = txState.fromAmount;
		if (!fromCoinDef || !toCoinDef || !fromAmount || fromAmount === '0') return 0;
		if (!swapResult || swapResult.expectedOutput <= 0n) return 0;
		const fromAmountInt = new CoinAmount(fromAmount, fromCoinDef.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) return 0;
		return priceImpactForRoute(BigInt(fromAmountInt), swapRoute);
	});
</script>

{#snippet tokenChips(tokens: AssetObject[], activeValue?: string)}
	<div class="token-chip-grid">
		{#each tokens as token (token.value)}
			{@const isFrom = token.value === txState.from?.coin.value}
			{@const isTo = token.value === txState.to?.coin.value}
			{@const isSelected = isFrom || isTo}
			{@const isActive = activeValue !== undefined && token.value === activeValue}
			<button
				class={['token-chip', { active: isActive, muted: isSelected && !isActive }]}
				onclick={() => selectToken(token)}
			>
				<img src={token.icon} alt={token.label} class="chip-icon" />
				<span>{coinDisplayLabel(token)}</span>
				{#if isSelected && !isActive}
					<span class="chip-role-badge">{isFrom ? 'FROM' : 'TO'}</span>
				{/if}
			</button>
		{/each}
		{#if customAssetObjs.length > 0}
			{@const customIsFrom =
				!!activeCustomObj && activeCustomObj.value === txState.from?.coin.value}
			{@const customIsTo = !!activeCustomObj && activeCustomObj.value === txState.to?.coin.value}
			{@const customIsSelected = customIsFrom || customIsTo}
			{@const customIsActive =
				activeValue !== undefined && customAssetObjs.some((o) => o.value === activeValue)}
			<button
				class={[
					'token-chip',
					'token-chip-category',
					{ active: customIsActive, muted: customIsSelected && !customIsActive }
				]}
				onclick={openCustomStep}
			>
				<img src={activeCustomObj?.icon ?? CUSTOM_TOKEN_ICON} alt="" class="chip-icon" />
				<span>{activeCustomObj ? coinDisplayLabel(activeCustomObj) : 'Custom'}</span>
				{#if customIsSelected && !customIsActive}
					<span class="chip-role-badge">{customIsFrom ? 'FROM' : 'TO'}</span>
				{:else}
					<span class="chip-chevron" aria-hidden="true"><ChevronRight size={14} /></span>
				{/if}
			</button>
		{/if}
	</div>
{/snippet}

<Dialog bind:open={dialogOpen} bind:toggle back={dialogBack}>
	{#snippet title()}Select a token{/snippet}
	{#snippet content()}
		{#if dialogStep === 'tokens'}
			<!-- Step 1: Select a token -->
			{@const generalChips = getFilteredTokens(
				currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs
			)}
			<div class="dialog-content">
				<div class="token-search-wrapper">
					<Search size={16} />
					<input bind:value={tokenSearch} placeholder="Search tokens..." />
				</div>
				{@render tokenChips(generalChips)}
				<span class="dialog-section-label">ALL ASSETS</span>
				<p class="dialog-hint">Select a token to see your available balances</p>
			</div>
		{:else if dialogStep === 'custom'}
			<!-- Drill-in from the Custom chip. Listed as cards rather than chips:
			     custom tokens are far less familiar than HIVE/HBD/BTC, so the
			     full name and the user's balance earn their space here. -->
			{@const customChips = getFilteredTokens(customAssetObjs)}
			<div class="dialog-content">
				<div class="token-search-wrapper">
					<Search size={16} />
					<input bind:value={tokenSearch} placeholder="Search custom tokens..." />
				</div>
				{#if customChips.length > 0}
					<div class="network-cards">
						{#each customChips as token (token.value)}
							{@const meta = customTokens.find((t) => t.symbol === token.value)}
							<button class="network-card" onclick={() => selectToken(token)}>
								<img src={token.icon} alt="" class="network-card-icon" />
								<div class="network-card-info">
									<span class="network-card-name">{token.label}</span>
									{#if meta && meta.name !== token.label}
										<span class="network-card-sub sm-caption">{meta.name}</span>
									{/if}
								</div>
								<div class="network-card-balance">
									<span class="balance-amount"
										>{getNetworkBalance(token.value, Network.magi.value)}</span
									>
									<span class="balance-label sm-caption">available</span>
								</div>
							</button>
						{/each}
					</div>
				{:else}
					<p class="dialog-hint">
						{tokenSearch.trim() ? 'No custom tokens match your search.' : 'No custom tokens yet.'}
					</p>
				{/if}
			</div>
		{:else if dialogStep === 'source' && tempCoinOpt}
			<!-- Step 2: Show balances for selected token -->
			{@const generalChips = getFilteredTokens(
				currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs
			)}
			<div class="dialog-content">
				<!-- The search box vanished on this step, so switching to a
				     different asset meant going Back first — and the chips
				     above are already filtered by the same term. -->
				<div class="token-search-wrapper">
					<Search size={16} />
					<input bind:value={tokenSearch} placeholder="Search tokens..." />
				</div>
				{@render tokenChips(generalChips, tempCoinOpt.coin.value)}
				<span class="dialog-section-label">ALL ASSETS</span>
				<div class="network-cards">
					{#each selectableNetworks(tempCoinOpt) as net (net.value)}
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
			<!-- Card header: the one switch that reveals every expert control on
			     this screen. The visible "Swap" title is gone — the nav tab and
			     the submit button both already say it, so a third one on the
			     same screen was noise. The heading stays for screen readers,
			     which have no tab or button in view to borrow the name from. -->
			<div class="card-head">
				<h2 class="card-title-a11y">Swap</h2>
				<label class="advanced-toggle">
					<input
						type="checkbox"
						checked={advanced}
						onchange={(e) => setAdvanced(e.currentTarget.checked)}
					/>
					Advanced
				</label>
			</div>
			<!-- You pay -->
			<SwapAmountField
				label="You pay"
				hint="The asset leaving your wallet, and how much of it. Everything below updates from this amount."
				networkLabel={txState.from?.network.label}
				external={!!txState.from && txState.from.network.value !== 'magi'}
				balance={txState.from && maxAmount
					? `Balance: ${maxAmount.toPrettyAmountString()} ${coinDisplayLabel(txState.from.coin)}`
					: undefined}
				coinIcon={txState.from?.coin.icon}
				coinLabel={txState.from ? coinDisplayLabel(txState.from.coin) : undefined}
				onPickToken={() => openDialog('from')}
				usd={inputAmountUsd !== null ? `≈ ${formatUsd(inputAmountUsd)}` : null}
				priceUnavailable={pricesFailed &&
					!!txState.from &&
					!!txState.fromAmount &&
					txState.fromAmount !== '0'}
				amount={fromAmountInput}
				errors={fromErrors}
			/>

			<!-- Swap Arrow -->
			<div class="swap-toggle-wrapper">
				<button
					type="button"
					class={['swap-arrow-btn', { disabled: !canSwapPositions }]}
					disabled={!canSwapPositions}
					onclick={swapPositions}
					aria-label="Swap token positions"
				>
					<span class="arrow-icon arrow-single"><ArrowDown size={16} /></span>
					<span class="arrow-icon arrow-swap"><ArrowUpDown size={16} /></span>
				</button>
			</div>

			<!-- You receive -->
			<SwapAmountField
				label="You receive"
				hint="The estimate at the current pool price, after fees. The exact amount is set when the swap executes — 'Min received' below is the floor you are protected to."
				networkLabel={txState.to?.network.label}
				external={!!txState.to && txState.to.network.value !== 'magi'}
				coinIcon={txState.to?.coin.icon}
				coinLabel={txState.to ? coinDisplayLabel(txState.to.coin) : undefined}
				onPickToken={() => openDialog('to')}
				usd={expectedOutputUsd !== null ? `≈ ${formatUsd(expectedOutputUsd)}` : null}
				priceUnavailable={pricesFailed &&
					!!txState.to &&
					!!txState.toAmount &&
					txState.toAmount !== '0'}
				amount={toAmountInput}
				errors={toErrors}
			/>

			<!-- Who gets paid. Not gated on Advanced: the controls are expert,
			     the answer is not. -->
			<div class="recipient-bar">
				<span class="recipient-label">To</span>
				<span class="recipient-who">{recipientSummary.who}</span>
				{#if recipientSummary.mine}<span class="recipient-mine sm-caption">(you)</span>{/if}
				<span class="tag-sep">&middot;</span>
				<span class="recipient-where sm-caption">{recipientSummary.where}</span>
				{#if !advanced}
					<button type="button" class="recipient-change" onclick={() => setAdvanced(true)}>
						Change
					</button>
				{/if}
			</div>

			<!-- Route Info -->
			{#if txState.from && txState.to}
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
		<!-- Deliver To Section. An expert control: the default swap keeps the
		     asset on Magi in the user's own account, so it only appears under
		     Advanced. The quote summary below it is NOT gated — it shares this
		     column but is what every user reads before confirming. -->
		{#if advanced}
			<div class="deliver-to-card">
				<!-- "Change" on the recipient bar opens this box by switching
				     Advanced on. Without the reverse here, the only way back to
				     the simple layout is the Advanced checkbox at the top of the
				     other card — which is not where the reader is looking, and
				     is not obviously the thing that opened this. -->
				<div class="deliver-head">
					<span class="deliver-label">DELIVER TO</span>
					<button
						type="button"
						class="deliver-hide"
						onclick={() => setAdvanced(false)}
						title="Back to the simple layout: pay to your own wallet, default slippage"
					>
						Hide
					</button>
				</div>

				{#if txState.to}
					<div class="dest-header">
						<CoinNetworkIcon
							coin={toCoin}
							network={txState.to?.network ?? Network.magi}
							size={28}
						/>
						<h3>Where should {coinDisplayLabel(toCoin)} go?</h3>
					</div>
				{/if}

				<!-- Settlement network. Governs BOTH destinations below: whether
				     the output is paid to the user or to a typed address is a
				     separate question from which chain it lands on. -->
				<div class="dest-network-row">
					<span class="dest-network-label">Settlement network</span>
					<div class="dest-network-toggle">
						<button
							class:active={destNetwork.value !== Network.magi.value}
							disabled={!!mainnetDestBlocked}
							title={mainnetDestBlocked}
							onclick={() => {
								destNetworkChoice = 'mainnet';
							}}>{chainLabel}</button
						>
						<button
							class:active={destNetwork.value === Network.magi.value}
							onclick={() => {
								destNetworkChoice = 'magi';
							}}>Magi Network</button
						>
					</div>
				</div>

				{#if mainnetDestBlocked && destNetworkChoice === 'mainnet'}
					<p class="dest-hint sm-caption">{mainnetDestBlocked}</p>
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
							<span class="dest-card-name">My own wallet</span>
							<span class="dest-card-desc sm-caption"
								>Swap to yourself &middot; Settles on {destNetwork.value === Network.magi.value
									? 'Magi'
									: chainLabel}.</span
							>
						</div>
						<div class="dest-radio" class:checked={destChoice === 'wallet'}></div>
					</button>

					{#if destChoice === 'wallet'}
						<!-- Logged out there is no wallet to name, and the label fell
						     through to "EVM" and stated it as fact (L9). -->
						{@const connectedWalletLabel =
							auth.value?.provider === 'aioha'
								? 'HIVE'
								: auth.value?.did?.startsWith('did:pkh:bip122:')
									? 'BTC'
									: 'EVM'}
						{@const settleOn = destNetwork.value === Network.magi.value ? 'Magi' : chainLabel}
						<div class="wallet-settle-info">
							<span class="settle-dot"></span>
							<span class="settle-text">
								{#if auth.status === 'authenticated'}
									{coinDisplayLabel(toCoin)} will settle in your {connectedWalletLabel} wallet on
									{settleOn}.
								{:else}
									Connect a wallet to receive {coinDisplayLabel(toCoin)} on {settleOn}.
								{/if}
							</span>
						</div>
					{/if}

					<button
						class="dest-card"
						class:selected={destChoice === 'address'}
						disabled={toIsMagiOnly}
						title={toIsMagiOnly
							? `${coinDisplayLabel(toCoin)} only exists on the Magi network`
							: undefined}
						onclick={() => {
							destChoice = 'address';
						}}
					>
						<div class="dest-card-icon"><Send size={18} /></div>
						<div class="dest-card-info">
							<span class="dest-card-name">Send to address</span>
							<span class="dest-card-desc sm-caption">
								{#if toIsMagiOnly}
									Unavailable &middot; {coinDisplayLabel(toCoin)} only exists on Magi
								{:else}
									Pay someone else &middot; Settles on the network chosen above
								{/if}
							</span>
						</div>
						<div class="dest-radio" class:checked={destChoice === 'address'}></div>
					</button>
				</div>

				<!-- Address Section -->
				<div class="dest-address-section" class:hidden={destChoice !== 'address'}>
					<textarea
						bind:value={destAddress}
						placeholder="Paste {recipientHint(recipientTarget)}... *"
						rows="2"
						spellcheck="false"
						autocapitalize="off"
						aria-invalid={!!destError}
						class:empty-required={destChoice === 'address' && !destAddress?.trim()}
						class:invalid={!!destError}
						disabled={destChoice !== 'address'}
					></textarea>
					{#if destError}
						<p class="dest-error sm-caption">{destError}</p>
					{:else if evmPayout}
						<!-- A payout on Ethereum is not just "it arrives": the bridge's
						     proving fee and the chain's gas come out of the amount, and
						     below its minimum withdrawal it cannot go at all. -->
						{@const unit = coinDisplayLabel(evmPayout.coin)}
						{@const dec = evmPayout.coin.decimalPlaces}
						<p class="dest-hint sm-caption">
							{unit} is sent to this address on {ETH_NETWORK} by the bridge. {ETH_PAYOUT_NOTE} Its
							proving fee ({shortUnits(evmPayout.proofFee, dec)}
							{unit}) and the Ethereum gas come out of the amount.
							{#if payoutLine?.arrives != null && payoutLine.gas != null}
								Ethereum gas now: {shortUnits(payoutLine.gas, dec)}
								{unit}. Arrives: about {shortUnits(payoutLine.arrives, dec)}
								{unit}.
							{:else if payoutGas.status === 'legacy'}
								The bridge takes the most the Ethereum gas can cost{evmPayout.coin.value ===
								Coin.usdc.value
									? ' (up to half its minimum withdrawal, in USDC)'
									: ''} and returns the unused part to your Magi account after the payout settles.
							{:else if payoutGas.status === 'unavailable'}
								The bridge is waiting for a fresh Ethereum block: the payout goes out as soon as it
								can, usually within minutes.
							{/if}
						</p>
						{#if payoutLine?.heavy}
							<p class="dest-error sm-caption">
								Ethereum gas is more than a tenth of this payout: a larger swap loses less to it.
							</p>
						{/if}
						{#if destChoice === 'address' && destAddress.trim() && !destValid}
							<p class="dest-error sm-caption">
								Not a valid Ethereum address: 0x and 40 hex characters (a mixed-case address must
								match its checksum).
							</p>
						{/if}
						{#if destChoice === 'address' && evmPayout.belowMin}
							<p class="dest-error sm-caption">
								{#if evmPayout.min == null}
									Loading the bridge's minimum withdrawal&hellip;
								{:else}
									A payout on Ethereum needs at least {shortUnits(evmPayout.min, dec)}
									{unit} after the bridge's proving fee (its minimum withdrawal): swap a larger
									amount.
								{/if}
							</p>
						{/if}
					{:else}
						<p class="dest-hint sm-caption">
							{coinDisplayLabel(toCoin)} arrives on {destNetwork.value === Network.magi.value
								? 'Magi'
								: chainLabel} &mdash; accepts {recipientHint(recipientTarget)}
						</p>
					{/if}
				</div>
			</div>
		{/if}
		<!-- Fees Section (collapsible) -->
		{#if txState.from && txState.to}
			{@const toDec = txState.to.coin.decimalPlaces}
			{@const toUnit = coinDisplayLabel(txState.to.coin)}
			<SwapFees
				bind:slippageBps
				{advanced}
				{priceImpactPct}
				expectedOutput={swapResult
					? `${formatSmallUnits(shownExpectedOutput, toDec)} ${toUnit}`
					: undefined}
				expectedOutputUsd={expectedOutputUsd !== null
					? `\u2248 ${formatUsd(expectedOutputUsd)}`
					: null}
				minAmountOut={swapResult
					? `${formatSmallUnits(shownMinAmountOut, toDec)} ${toUnit}`
					: undefined}
				minAmountOutUsd={minAmountOutUsd !== null ? `\u2248 ${formatUsd(minAmountOutUsd)}` : null}
				protocolFeeUsd={totalSwapFeeUsd !== null
					? `\u2248 ${formatUsdCost(totalSwapFeeUsd)}`
					: null}
				{swapFeePct}
				twoHop={!!swapResult?.hop1Fee}
				{exchangeFeePct}
				hasQuote={!!swapResult}
				{poolLoadFailed}
				{poolLoadingRetry}
				onRetry={() => loadPoolsWithRetry()}
			/>
		{/if}
	</div>
</div>

<!-- Sits here, after the card and before the machine's own NavButtons, so the
     reason reads directly above the button it explains (L4). -->
{#if isActive && reviewBlocker}
	<p class="review-blocker sm-caption">{reviewBlocker}</p>
{/if}

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

<!-- The amount inputs and the inline errors stay here: they are bound to the
     swap state machine and to the quote effect above, and SwapAmountField is
     only the chrome around them. -->
{#snippet fromAmountInput()}
	<AmountInput
		bind:coinAmount={inputAmount}
		coinOpts={amountInputCoinOpts}
		{minAmount}
		maxAmount={maxSendable}
		hideUnit
		hideUsd
		hideNetwork
	/>
{/snippet}

{#snippet toAmountInput()}
	<!-- Recreate AmountInput on zero↔non-zero so its initializer produces an
	     empty placeholder ('') instead of "0". -->
	{#key outputAmount.amount === 0}
		<AmountInput
			coinAmount={outputAmount}
			coinOpts={toAmountCoinOpts}
			hideUnit
			hideUsd
			hideNetwork
			disabled
		/>
	{/key}
{/snippet}

{#snippet fromErrors()}
	{#if sameCoinError}
		<span class="section-error-inline">Select a different token</span>
	{:else if insufficientBalance && txState.from}
		<span class="section-error-inline"
			>{paysBitcoinFee
				? `Not enough BTC for the amount plus the network fee (about ${$btcSendFeeReserve} sats)`
				: `Insufficient ${coinDisplayLabel(txState.from.coin)} balance`}</span
		>
	{:else if exceedsPoolDepth}
		<span class="section-error-inline">Insufficient pool liquidity — try a smaller amount</span>
	{/if}
{/snippet}

{#snippet toErrors()}
	<!-- Echo the pool-depth problem on the receive side: when the input
	     overflows the pool the calc clamps expectedOutput to 0 and the field
	     renders empty, which otherwise reads as "nothing happened". The other
	     two cases already show on the pay side. -->
	{#if exceedsPoolDepth}
		<span class="section-error-inline">Pool can't absorb this amount</span>
	{/if}
{/snippet}

<style lang="scss">
	.recipient-bar {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0.5rem 0 0;
		padding: 0.5rem 0.75rem;
		border-radius: 12px;
		background: var(--alt-field-2, rgba(0, 0, 0, 0.18));
		font-size: var(--text-sm);
	}
	.recipient-label {
		color: var(--dash-text-muted);
	}
	.recipient-who {
		font-weight: 600;
		color: var(--dash-text-primary);
		overflow-wrap: anywhere;
	}
	.recipient-mine,
	.recipient-where {
		color: var(--dash-text-muted);
	}
	.recipient-change {
		margin-left: auto;
		border: none;
		background: transparent;
		padding: 0 0.25rem;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--dash-accent-purple);
		cursor: pointer;
		text-decoration: underline;
	}

	.review-blocker {
		margin: 0 0 0.25rem;
		text-align: center;
		color: var(--dash-text-muted);
	}

	/* ── Card header: the Advanced switch ──────────────────────────────── */
	.card-head {
		display: flex;
		align-items: center;
		/* The title is hidden, so the switch is the only thing laid out here;
		   `space-between` would send it to the left edge. */
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 6px 8px 10px 14px;
	}
	/* Kept in the accessibility tree, out of the layout. Clipped rather than
	   `display: none`, which would drop it from the tree along with the
	   document outline it gives the card. */
	.card-title-a11y {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.advanced-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 34px;
		padding: 0 10px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		color: var(--dash-text-secondary);
		cursor: pointer;
		user-select: none;
	}
	.advanced-toggle:hover {
		color: var(--dash-text-primary);
	}
	/* Size, shape and colour come from the `.alt-root input[type='checkbox']`
	   rule in redesign.scss, so every checkbox on the new shell matches. */

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

	/* ── Swap Toggle ── */
	.swap-toggle-wrapper {
		display: flex;
		justify-content: center;
		padding: 0.125rem 0;
		position: relative;
		z-index: 1;
	}
	.swap-arrow-btn {
		all: unset;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		border: 1px solid rgba(111, 106, 248, 0.4);
		background: var(--dash-card-bg);
		color: #6f6af8;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.25s,
			border-color 0.25s,
			color 0.25s;
		position: relative;

		.arrow-icon {
			position: absolute;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: opacity 0.25s ease;
		}
		.arrow-single {
			opacity: 1;
		}
		.arrow-swap {
			opacity: 0;
		}

		&:hover:not(:disabled) {
			background: #6f6af8;
			border-color: #6f6af8;
			color: #fff;
			.arrow-single {
				opacity: 0;
			}
			.arrow-swap {
				opacity: 1;
			}
		}
		&:active:not(:disabled) {
			transform: scale(0.9);
		}
		&.disabled,
		&:disabled {
			cursor: not-allowed;
			color: var(--dash-text-muted);
			border-color: var(--dash-card-border);
		}
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

	.section-error-inline {
		font-size: var(--text-xs);
		color: var(--negative-text, #f87171);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		margin-left: auto;
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
	.deliver-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.deliver-label {
		color: var(--dash-text-muted);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	/* Deliberately the same affordance as the "Change" link that opens this,
	   so the pair reads as one toggle rather than two unrelated controls. */
	.deliver-hide {
		border: none;
		background: transparent;
		padding: 0 0.25rem;
		font: inherit;
		font-size: var(--text-sm);
		color: var(--dash-accent-purple);
		cursor: pointer;
		text-decoration: underline;
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
		&:hover:not(.selected):not(:disabled) {
			border-color: var(--dash-card-border);
			background-color: var(--dash-surface);
		}
		/* Magi-only target asset: mainnet settlement doesn't exist for it. */
		&:disabled {
			cursor: not-allowed;
			opacity: 0.45;
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
			&:not(.active):hover:not(:disabled) {
				background-color: var(--dash-surface);
			}
			&:disabled {
				opacity: 0.45;
				cursor: not-allowed;
			}
		}
	}
	.dest-error {
		color: var(--alt-red, #ff6b6b);
	}
	textarea.invalid {
		border-color: var(--alt-red, #ff6b6b);
	}
	.dest-hint {
		margin: 0;
		color: var(--dash-text-muted);
	}
	.dest-hint.dest-error {
		color: var(--dash-accent-red);
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

	/* The Custom chip stands for a category, not a token — a dashed edge and
	   the chevron distinguish it from the concrete assets beside it. */
	.token-chip-category {
		border-style: dashed;
		.chip-chevron {
			display: inline-flex;
			align-items: center;
			margin-left: -0.15rem;
			color: var(--dash-text-muted);
		}
		&:hover .chip-chevron {
			color: var(--dash-text-primary);
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
	.token-chip.muted {
		position: relative;
		border-color: var(--dash-accent-purple);
	}
	.chip-role-badge {
		position: absolute;
		top: -0.4rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #fff;
		background: var(--dash-accent-purple, #6f6af8);
		border-radius: 4px;
		padding: 0.15rem 0.3rem 0.1rem;
		line-height: 1;
		pointer-events: none;
		z-index: 1;
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
		.network-card-sub {
			color: var(--dash-text-muted);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
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
	}
</style>
