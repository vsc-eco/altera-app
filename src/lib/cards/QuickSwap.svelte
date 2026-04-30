<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import {
		blankDetails,
		SendTxDetails,
		solveNetworkConstraints,
		optionsEqual
	} from '$lib/sendswap/utils/sendUtils';
	import swapOptions, {
		Coin,
		Network,
		TransferMethod,
		type CoinOnNetwork
	} from '$lib/sendswap/utils/sendOptions';
	import {
		SWAP_QUICK_PREF_KEY,
		loadSwapSelection,
		saveSwapSelection,
		findFromOpt,
		findToOpt,
		findNetwork
	} from '$lib/sendswap/utils/swapPersistence';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Dialog from '$lib/zag/Dialog.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import {
		accountBalance,
		getBalanceSmallestUnits,
		type AccountBalance
	} from '$lib/stores/currentBalance';
	import { untrack } from 'svelte';
	import { ArrowDown, ChevronDown, Search } from '@lucide/svelte';
	import { getHiveAssetName, getHbdAssetName, isVscTestnet } from '$lib/../client';
	import { modal } from '$lib/auth/reown';
	import {
		fetchTypedPoolDepths,
		calculateSwap,
		calculateTwoHopSwap,
		getOrderedDepthsFor,
		checkExceedsPoolDepth,
		calculatePriceImpact,
		type TypedPoolDepths,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';
	import {
		getHiveSwapOp,
		getBtcApproveOp,
		SWAP_CONTRACT_ID,
		qualifiesForAlteraFee,
		ALTERA_FEE_BENEFICIARY,
		ALTERA_FEE_BPS,
		ALTERA_FEE_ACTIVE,
		getAlteraFeePct
	} from '$lib/magiTransactions/hive/vscOperations/swap';
	import { getHiveDepositOp } from '$lib/magiTransactions/hive/vscOperations/deposit';
	import { executeTx } from '$lib/magiTransactions/hive';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import {
		createClient,
		signAndBrodcastTransaction,
		type CallContractTransaction
	} from '$lib/magiTransactions/eth/client';
	import { wagmiSigner } from '$lib/magiTransactions/eth/wagmi';
	import { wagmiConfig } from '$lib/auth/reown';
	import ReviewSwap from '$lib/sendswap/stages/ReviewSwap.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { validate as validateBtcAddr, Network as BtcNetwork } from 'bitcoin-address-validation';
	import QRCode from 'qrcode';

	const auth = $derived(getAuth()());

	/**
	 * QuickSwap exposes only native mainnet chains — never Magi-mapped.
	 * Returns the right Network for a given coin: btcMainnet for BTC,
	 * hiveMainnet for HIVE/HBD/sHBD, falling back to the coin's first
	 * non-magi-non-lightning network otherwise.
	 */
	function nativeNetworkFor(coinValue: string): Network {
		if (coinValue === Coin.btc.value) return Network.btcMainnet;
		if (
			coinValue === Coin.hive.value ||
			coinValue === Coin.hbd.value ||
			coinValue === (Coin.shbd?.value ?? '')
		)
			return Network.hiveMainnet;
		// Generic fallback: first non-magi, non-lightning network on the coin
		const opt = swapOptions.from.coins.find((c) => c.coin.value === coinValue);
		const native = opt?.networks.find(
			(n) => n.value !== Network.magi.value && n.value !== Network.lightning.value
		);
		return native ?? Network.hiveMainnet;
	}

	function startDetails() {
		const stored = loadSwapSelection(SWAP_QUICK_PREF_KEY);
		const btcFromOption = swapOptions.from.coins.find((c) => c.coin.value === Coin.btc.value);
		const hiveFromOption = swapOptions.from.coins.find((c) => c.coin.value === Coin.hive.value);
		const btcToOption = swapOptions.to.coins.find((c) => c.coin.value === Coin.btc.value);
		const hiveToOption = swapOptions.to.coins.find((c) => c.coin.value === Coin.hive.value);

		// Defaults depend on the connected wallet type:
		// - Reown BTC wallet → from BTC, to HIVE (only valid FROM is BTC)
		// - Hive wallet (aioha) → from HIVE, to BTC
		// Persisted selection overrides for non-forced wallets.
		const isReownBtc =
			auth.value?.provider === 'reown' && auth.value.did?.startsWith('did:pkh:bip122:');
		const isHive = auth.value?.provider === 'aioha';

		const defaultFrom = isReownBtc ? btcFromOption : isHive ? hiveFromOption : btcFromOption;
		const defaultTo = isReownBtc ? hiveToOption : isHive ? btcToOption : hiveToOption;

		const fromOpt = isReownBtc ? btcFromOption : (findFromOpt(stored?.fromCoin) ?? defaultFrom);
		const toOpt = isReownBtc ? hiveToOption : (findToOpt(stored?.toCoin) ?? defaultTo);
		// Always derive the network from the coin's native mainnet — ignore
		// any persisted `magi` value left over from earlier code.
		const fromNet = fromOpt ? nativeNetworkFor(fromOpt.coin.value) : undefined;
		const toNet = toOpt ? nativeNetworkFor(toOpt.coin.value) : undefined;
		return {
			...blankDetails(),
			method: TransferMethod.lightningTransfer,
			fromCoin: fromOpt ?? undefined,
			fromNetwork: fromNet,
			toCoin: toOpt ?? undefined,
			toNetwork: toNet
		};
	}

	let swapDetailsInitialized = $state(false);
	$effect(() => {
		if (!auth.value || swapDetailsInitialized) return;
		swapDetailsInitialized = true;
		SendTxDetails.set(startDetails());
	});

	// Persist the user's QuickSwap source/target selection (own key — does
	// not share state with the /swap page persistence). Partial state is
	// allowed: save as soon as either side is populated.
	// IMPORTANT: read the store fields BEFORE the gate so they're tracked
	// as dependencies on the first (gated) effect run — otherwise this
	// effect would never re-fire when the user changes a selection.
	$effect(() => {
		const fromCoin = $SendTxDetails.fromCoin?.coin.value;
		const fromNetwork = $SendTxDetails.fromNetwork?.value;
		const toCoin = $SendTxDetails.toCoin?.coin.value;
		const toNetwork = $SendTxDetails.toNetwork?.value;
		if (!swapDetailsInitialized) return;
		if (fromCoin || toCoin) {
			saveSwapSelection(SWAP_QUICK_PREF_KEY, { fromCoin, fromNetwork, toCoin, toNetwork });
		}
	});

	/**
	 * Track the last value we auto-filled into toUsername from the
	 * connected wallet. We only overwrite toUsername when its current
	 * value matches what we last wrote — that way a user-typed value is
	 * never clobbered, but a previously-auto-filled value gets cleared
	 * once the target chain no longer matches the wallet's chain.
	 */
	let lastAutofilledReceiver = $state<string | null>(null);

	$effect(() => {
		if (!auth.value) return;
		const provider = auth.value.provider;
		const toValue = $SendTxDetails.toCoin?.coin.value;

		const walletMatchesTo =
			(provider === 'aioha' && (toValue === Coin.hive.value || toValue === Coin.hbd.value)) ||
			(provider === 'reown' && toValue === Coin.btc.value);

		const walletReceiver = getUsernameFromAuth(auth) ?? auth.value.address ?? '';

		// Reads of and writes to toUsername must stay untracked — otherwise
		// writing re-fires the effect and we hit effect_update_depth_exceeded.
		untrack(() => {
			const current = $SendTxDetails.toUsername;
			if (walletMatchesTo && walletReceiver) {
				if (!current || current === lastAutofilledReceiver) {
					if (current !== walletReceiver) {
						$SendTxDetails.toUsername = walletReceiver;
					}
					lastAutofilledReceiver = walletReceiver;
				}
			} else if (current === lastAutofilledReceiver && current) {
				$SendTxDetails.toUsername = '';
				lastAutofilledReceiver = null;
			}
		});
	});

	let { assetOptions, networkOptions } = $state<ReturnType<typeof solveNetworkConstraints>>({
		assetOptions: [],
		networkOptions: []
	});
	$effect(() => {
		const result = solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			$SendTxDetails.toNetwork,
			auth.value?.did,
			$SendTxDetails.fromNetwork,
			true
		);
		if (!optionsEqual(result.assetOptions, assetOptions)) assetOptions = result.assetOptions;
		if (!optionsEqual(result.networkOptions, networkOptions))
			networkOptions = result.networkOptions;
	});

	// From tokens: all available coins (BTC, HIVE, HBD) — exclude sHBD
	const fromAssetObjs: AssetObject[] = $derived(
		swapOptions.from.coins
			.filter((opt) => opt.coin.value !== Coin.shbd?.value)
			.map((opt) => ({
				...opt.coin,
				snippet: assetCard,
				snippetData: {
					fromOpt: opt,
					net: opt.networks?.[0] || Network.magi,
					size: 'medium'
				}
			}))
	);
	// To tokens: all coins Magi supports (show all, not just those with balance) — exclude sHBD
	const toAssetObjs: AssetObject[] = $derived(
		swapOptions.to.coins
			.filter((opt) => opt.coin.value !== Coin.shbd?.value)
			.map((opt) => ({
				...opt.coin,
				snippet: assetCard,
				snippetData: { fromOpt: opt, net: Network.magi, size: 'medium' }
			}))
	);

	let possibleCoins: CoinOnNetwork[] = $derived.by(() => {
		const result: CoinOnNetwork[] = [];
		if ($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork) {
			result.push({ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork });
		}
		if ($SendTxDetails.toCoin && $SendTxDetails.toNetwork) {
			result.push({ coin: $SendTxDetails.toCoin.coin, network: $SendTxDetails.toNetwork });
		}
		const btcIndex = result.findIndex((c) => c.coin.value === Coin.btc.value);
		if (btcIndex !== -1) {
			result.splice(btcIndex + 1, 0, { coin: Coin.sats, network: result[btcIndex].network });
		}
		return result;
	});

	// Single-option list for From amount input so AmountInput does not show internal dropdown
	const fromOnlyCoinOpts: CoinOnNetwork[] = $derived.by(() => {
		if (!$SendTxDetails.fromCoin || !$SendTxDetails.fromNetwork) return [];
		return [{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork }];
	});

	// Single-option list for To amount input
	const toOnlyCoinOpts: CoinOnNetwork[] = $derived.by(() => {
		if (!$SendTxDetails.toCoin || !$SendTxDetails.toNetwork) return [];
		return [{ coin: $SendTxDetails.toCoin.coin, network: $SendTxDetails.toNetwork }];
	});

	let inputAmount = $state(new CoinAmount(0, Coin.unk));
	let toInputAmount = $state(new CoinAmount(0, Coin.unk));
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
		if (toInputAmount.coin.value === $SendTxDetails.toCoin.coin.value) {
			const amt = toInputAmount.toAmountString();
			if (amt !== $SendTxDetails.toAmount) $SendTxDetails.toAmount = amt;
		} else {
			toInputAmount.convertTo($SendTxDetails.toCoin.coin, Network.lightning).then((amt) => {
				if ($SendTxDetails.toAmount !== amt.toAmountString()) {
					$SendTxDetails.toAmount = amt.toAmountString();
				}
			});
		}
	});

	let fromInTo = $state('');
	$effect(() => {
		if ($SendTxDetails.fromCoin && $SendTxDetails.toCoin) {
			new CoinAmount(1, $SendTxDetails.fromCoin.coin)
				.convertTo($SendTxDetails.toCoin.coin, Network.lightning)
				.then((amt) => {
					fromInTo = formatRateAmount(amt);
				});
		}
	});

	let toPriceUsdRaw = $state(0);
	$effect(() => {
		if ($SendTxDetails.toCoin) {
			new CoinAmount(1, $SendTxDetails.toCoin.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amt) => {
					toPriceUsdRaw = amt.toNumber();
				});
		}
	});

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

	function formatUsd(amount: number): string {
		return amount.toLocaleString(undefined, {
			useGrouping: true,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	/**
	 * Formats a coin amount for the Rate row — always decimal notation, no scientific
	 * notation, trailing zeros stripped, thousands separator on the integer part only.
	 *   0.00000079 BTC  (not "7.900e-7 BTC" or "0.00000079000000 BTC")
	 *   0.07 HBD        (not "0.070 HBD")
	 *   1,265,822 HIVE
	 */
	function formatRateAmount(amt: CoinAmount<Coin>): string {
		const val = amt.toNumber();
		if (val === 0) return `0 ${amt.getDisplayUnit()}`;
		const fixed = val
			.toFixed(amt.coin.decimalPlaces)
			.replace(/(\.\d*[1-9])0+$/, '$1') // strip trailing zeros
			.replace(/\.0*$/, ''); // strip trailing dot
		const [intPart, decPart] = fixed.split('.');
		const formatted =
			intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? `.${decPart}` : '');
		return `${formatted} ${amt.getDisplayUnit()}`;
	}

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

	// Pool-based fee calculation — resolve both HIVE/HBD and BTC/HBD
	// pools upfront so the swap calc can route HIVE↔HBD single-hop,
	// BTC↔HBD single-hop, and BTC↔HIVE two-hop via HBD. Uses the
	// indexer fallback for chain-state reads so testnet pools without
	// getStateByKeys support still work.
	let hiveHbdPool = $state<TypedPoolDepths | null>(null);
	let btcHbdPool = $state<TypedPoolDepths | null>(null);
	let swapResult: SwapCalcResult | null = $state(null);
	(async () => {
		const [hiveHbd, btcHbd] = await Promise.all([
			fetchTypedPoolDepths('HIVE', 'HBD'),
			fetchTypedPoolDepths('BTC', 'HBD')
		]);
		if (hiveHbd) hiveHbdPool = hiveHbd;
		if (btcHbd) btcHbdPool = btcHbd;
	})();

	$effect(() => {
		const fromCoin = $SendTxDetails.fromCoin;
		const toCoin = $SendTxDetails.toCoin;
		const fromAmount = $SendTxDetails.fromAmount;
		if (!fromCoin || !toCoin || !fromAmount || fromAmount === '0') {
			swapResult = null;
			return;
		}
		const swapAssets = new Set([Coin.hive.value, Coin.hbd.value, Coin.btc.value]);
		if (
			!swapAssets.has(fromCoin.coin.value) ||
			!swapAssets.has(toCoin.coin.value) ||
			fromCoin.coin.value === toCoin.coin.value
		) {
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

		let result: SwapCalcResult | null = null;
		if (!involvesBtc) {
			if (!hiveHbdPool) {
				swapResult = null;
				return;
			}
			const d = getOrderedDepthsFor(hiveHbdPool, assetIn);
			if (!d) {
				swapResult = null;
				return;
			}
			result = calculateSwap(x, d.X, d.Y, slippageBps);
		} else if (
			(assetIn === Coin.btc.value && assetOut === Coin.hbd.value) ||
			(assetIn === Coin.hbd.value && assetOut === Coin.btc.value)
		) {
			if (!btcHbdPool) {
				swapResult = null;
				return;
			}
			const d = getOrderedDepthsFor(btcHbdPool, assetIn);
			if (!d) {
				swapResult = null;
				return;
			}
			result = calculateSwap(x, d.X, d.Y, slippageBps);
		} else {
			// BTC ↔ HIVE: two-hop via HBD.
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

		// Mirror the swap calc into $SendTxDetails so ReviewSwap can read
		// the same numbers (fee, slippage, expected output) without
		// recomputing or showing a "loading…" placeholder. Also drive
		// the TO amount input from the pool result.
		const poolOutAmount = Number(result.expectedOutput);
		untrack(() => {
			const expectedOutput = result.expectedOutput.toString();
			const minAmountOut = result.minAmountOut.toString();
			const swapBaseFee = result.baseFee.toString();
			const swapClpFee = result.clpFee.toString();
			const swapTotalFee = result.totalFee.toString();
			if ($SendTxDetails.expectedOutput !== expectedOutput)
				$SendTxDetails.expectedOutput = expectedOutput;
			if ($SendTxDetails.slippageBps !== slippageBps) $SendTxDetails.slippageBps = slippageBps;
			if ($SendTxDetails.minAmountOut !== minAmountOut) $SendTxDetails.minAmountOut = minAmountOut;
			if ($SendTxDetails.swapBaseFee !== swapBaseFee) $SendTxDetails.swapBaseFee = swapBaseFee;
			if ($SendTxDetails.swapClpFee !== swapClpFee) $SendTxDetails.swapClpFee = swapClpFee;
			if ($SendTxDetails.swapTotalFee !== swapTotalFee) $SendTxDetails.swapTotalFee = swapTotalFee;
			const hop1 = result.hop1Fee
				? { asset: result.hop1Fee.asset, totalFee: result.hop1Fee.totalFee.toString() }
				: undefined;
			const prevHop1 = $SendTxDetails.swapHop1Fee;
			const hop1Changed = hop1
				? !prevHop1 || prevHop1.asset !== hop1.asset || prevHop1.totalFee !== hop1.totalFee
				: !!prevHop1;
			if (hop1Changed) $SendTxDetails.swapHop1Fee = hop1;

			// Drive the TO amount input. Wrapped in untrack so reading
			// toInputAmount here doesn't turn this effect into a loop;
			// guarded so repeat passes with the same value don't thrash
			// AmountInput's external-sync.
			if (Number.isFinite(poolOutAmount) && poolOutAmount > 0) {
				if (
					toInputAmount.coin.value !== toCoin.coin.value ||
					toInputAmount.amount !== poolOutAmount
				) {
					toInputAmount = new CoinAmount(poolOutAmount, toCoin.coin, true);
				}
			}
		});
	});

	// Clear the TO field when there's no valid swap result, e.g. the
	// user deleted the FROM amount or picked incompatible coins.
	$effect(() => {
		const expectedRaw = $SendTxDetails.expectedOutput;
		const coin = $SendTxDetails.toCoin?.coin;
		if (!coin) return;
		if (expectedRaw && expectedRaw !== '0') return;
		untrack(() => {
			if (toInputAmount.amount !== 0 || toInputAmount.coin.value !== coin.value) {
				toInputAmount = new CoinAmount(0, coin, true);
			}
		});
	});

	function formatFee(val: bigint | number, decimals: number): string {
		const n = Number(val) / Math.pow(10, decimals);
		return n.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: decimals
		});
	}

	let minAmount: CoinAmount<Coin> | undefined = $state();
	$effect(() => {
		const amt = possibleCoins.some((c) => c.coin.value === Coin.btc.value)
			? new CoinAmount(0.0000025, Coin.btc)
			: undefined;
		untrack(() => {
			if (minAmount?.coin.value !== amt?.coin.value || minAmount?.toNumber() !== amt?.toNumber()) {
				minAmount = amt;
			}
		});
	});

	// Max amount for the FROM field. QuickSwap is strictly mainnet ↔
	// mainnet so the cap is whatever the user actually has on the
	// native chain, not the Magi-mapped balance. The balance store
	// already routes mainnet reads through `connectedBal` for both
	// Hive (from the L1 account) and BTC (from mempool.space via the
	// reown BitcoinAdapter address).
	const maxAmount = $derived.by(() => {
		const coin = $SendTxDetails.fromCoin?.coin;
		const network = $SendTxDetails.fromNetwork;
		if (!coin || !network) return undefined;
		const raw = getBalanceSmallestUnits($accountBalance, coin, network);
		if (raw <= 0) return undefined;
		return new CoinAmount(raw, coin, true);
	});

	let dialogOpen = $state(false);
	let toggle = $state<(open?: boolean) => void>(() => {});
	let currentlyOpen: 'from' | 'to' = $state('from');
	let tokenSearch = $state('');

	function openDialog(state: 'from' | 'to') {
		currentlyOpen = state;
		tokenSearch = '';
		toggle(true);
	}

	function closeDialog() {
		toggle(false);
		tokenSearch = '';
	}

	function getFilteredTokens(tokens: AssetObject[]): AssetObject[] {
		if (!tokenSearch.trim()) return tokens;
		const s = tokenSearch.toLowerCase().trim();
		return tokens.filter(
			(t) => t.label.toLowerCase().includes(s) || t.value.toLowerCase().includes(s)
		);
	}

	function coinDisplayLabel(coin: (typeof Coin)[keyof typeof Coin]): string {
		return coin.value === Coin.hive.value
			? getHiveAssetName()
			: coin.value === Coin.hbd.value
				? getHbdAssetName()
				: coin.label;
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

	/**
	 * Which asset values are eligible for the FROM side given the
	 * connected wallet. Hive (aioha) → hive/hbd; Bitcoin/EVM (reown) →
	 * btc. Everything else is disabled in the picker.
	 */
	const fromAllowedValues = $derived.by(() => {
		const provider = auth.value?.provider;
		const did = auth.value?.did ?? '';
		// QuickSwap is strictly mainnet ↔ mainnet — the FROM side must
		// be an asset the connected wallet can actually sign for on
		// its native chain. Aioha = Hive L1 → HIVE/HBD; reown BTC
		// (Leather/Xverse via BitcoinAdapter) → BTC; reown EVM = no
		// QuickSwap source yet.
		if (provider === 'aioha') return new Set([Coin.hive.value, Coin.hbd.value]);
		if (provider === 'reown' && did.startsWith('did:pkh:bip122:')) return new Set([Coin.btc.value]);
		return new Set<string>();
	});

	function isFromTokenAllowed(value: string): boolean {
		return fromAllowedValues.has(value);
	}

	/**
	 * A token is a valid TO pick if it's not the same as the current
	 * FROM selection. (Same-asset swaps are blocked by `sameCoinSelected`
	 * anyway, but disabling it at pick time is clearer to the user.)
	 */
	function isToTokenAllowed(value: string): boolean {
		const fromValue = $SendTxDetails.fromCoin?.coin.value;
		return !fromValue || value !== fromValue;
	}

	function selectToken(token: AssetObject) {
		if (currentlyOpen === 'from' && !isFromTokenAllowed(token.value)) return;
		if (currentlyOpen === 'to' && !isToTokenAllowed(token.value)) return;
		const source = currentlyOpen === 'from' ? swapOptions.from.coins : swapOptions.to.coins;
		const coinOpt = source.find((opt) => opt.coin.value === token.value);
		if (!coinOpt) return;

		// QuickSwap doesn't expose Magi-mapped sub-network selection — the
		// click on the token IS the selection. The chosen network is the
		// asset's native mainnet (btcMainnet for BTC, hiveMainnet for
		// HIVE/HBD), never Magi.
		const net = nativeNetworkFor(coinOpt.coin.value);
		if (currentlyOpen === 'from') {
			SendTxDetails.update((d) => ({ ...d, fromCoin: coinOpt, fromNetwork: net }));
		} else {
			SendTxDetails.update((d) => ({ ...d, toCoin: coinOpt, toNetwork: net }));
		}
		closeDialog();
	}

	let swapStatus = $state('');
	let swapLoading = $state(false);
	let swapError = $state(false);
	// Drives the confirm-swap popup. Set to true after validation passes;
	// the actual broadcast happens when the user confirms inside the popup.
	let reviewOpen = $state(false);
	// Drives the "send BTC to this address" popup shown for a reown-BTC
	// source. We fetch a per-swap deposit address from the mapping bot
	// and the user sends from their own wallet — same pattern the
	// existing BitcoinMainnetDeposit flow uses.
	let btcDepositOpen = $state(false);
	let btcDepositToggle = $state<(open?: boolean) => void>(() => {});
	let btcDepositAddress = $state<string | null>(null);
	let btcDepositLoading = $state(false);
	let btcDepositError = $state<string | null>(null);
	// QR code for the mapping-bot deposit address. Encoded as a BIP21
	// URI with the swap amount so Bitcoin wallets can prefill both
	// fields on scan.
	let btcDepositQr = $state<string | null>(null);
	$effect(() => {
		const addr = btcDepositAddress;
		const amountStr = $SendTxDetails.fromAmount ?? '0';
		if (!addr) {
			btcDepositQr = null;
			return;
		}
		const amountCa = new CoinAmount(amountStr, Coin.btc);
		const btcAmount = amountCa.toAmountString();
		const uri =
			btcAmount && btcAmount !== '0' ? `bitcoin:${addr}?amount=${btcAmount}` : `bitcoin:${addr}`;
		QRCode.toDataURL(uri, {
			width: 220,
			margin: 1,
			color: { dark: '#FFFFFF', light: '#00000000' }
		})
			.then((url) => {
				btcDepositQr = url;
			})
			.catch(() => {
				btcDepositQr = null;
			});
	});
	const reviewStatus = $derived({ message: swapStatus, isError: swapError });
	const hasAmount = $derived(
		!!$SendTxDetails.fromAmount && $SendTxDetails.fromAmount !== '0' && inputAmount.amount > 0
	);
	const sameCoinSelected = $derived(
		!!$SendTxDetails.fromCoin &&
			!!$SendTxDetails.toCoin &&
			$SendTxDetails.fromCoin.coin.value === $SendTxDetails.toCoin.coin.value
	);
	const missingReceiver = $derived(!$SendTxDetails.toUsername?.trim());
	const exceedsBalance = $derived.by(() => {
		const coin = $SendTxDetails.fromCoin?.coin;
		const network = $SendTxDetails.fromNetwork;
		if (!coin || !network) return false;
		const entered = inputAmount.amount;
		if (!Number.isFinite(entered) || entered <= 0) return false;
		const maxSmallest = getBalanceSmallestUnits($accountBalance, coin, network);
		if (maxSmallest <= 0) return false;
		return entered > maxSmallest;
	});

	const exceedsPoolDepth = $derived.by(() => {
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

	// Slippage tolerance in basis points. Matches the SwapOptions presets
	// on the /swap page so the behavior is identical here.
	const slippageOptions = [50, 100, 200, 300];
	let slippageBps = $state(100);
	let customSlippageOpen = $state(false);
	let customSlippageInput = $state('');
	let customSlippageInputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (customSlippageOpen && customSlippageInputEl) {
			customSlippageInputEl.focus();
			customSlippageInputEl.select();
		}
	});

	function applyCustomSlippage() {
		const raw = customSlippageInput.replace(',', '.').trim();
		const v = parseFloat(raw);
		if (!raw || isNaN(v) || v < 0.01 || v > 99.99) {
			customSlippageOpen = false;
			return;
		}
		slippageBps = Math.round(v * 100);
		customSlippageInput = parseFloat(v.toFixed(2)).toString();
		customSlippageOpen = false;
	}

	function setError(msg: string) {
		swapStatus = msg;
		swapError = true;
	}

	/**
	 * Validate inputs and wallet/asset compatibility. Returns true if the
	 * swap is ready to broadcast. Side-effects: writes swapStatus/swapError
	 * on failure.
	 */
	function validateSwap(): boolean {
		swapError = false;
		swapStatus = '';

		if (!auth.value) {
			setError('Connect your wallet first');
			return false;
		}
		if (!$SendTxDetails.fromCoin || !$SendTxDetails.toCoin) {
			setError('Select both tokens');
			return false;
		}
		if (sameCoinSelected) {
			setError('From and To assets must be different');
			return false;
		}
		if (!$SendTxDetails.fromAmount || $SendTxDetails.fromAmount === '0') {
			setError('Enter an amount');
			return false;
		}
		if (missingReceiver) {
			setError('Enter a receiver');
			return false;
		}
		// BTC target: receiver must be a valid Bitcoin address on the
		// appropriate network. Reject early so we never send a swap
		// instruction with a malformed/non-BTC recipient.
		if ($SendTxDetails.toCoin?.coin.value === Coin.btc.value) {
			const addr = $SendTxDetails.toUsername?.trim() ?? '';
			const net = isVscTestnet() ? BtcNetwork.testnet : BtcNetwork.mainnet;
			if (!validateBtcAddr(addr, net)) {
				setError(
					isVscTestnet()
						? 'Enter a valid Bitcoin testnet address'
						: 'Enter a valid Bitcoin mainnet address'
				);
				return false;
			}
		}
		if (exceedsBalance) {
			setError('Amount exceeds your wallet balance');
			return false;
		}
		if (exceedsPoolDepth) {
			setError('Amount exceeds 50% of pool depth — reduce the amount to continue');
			return false;
		}

		const fromCoinDef = $SendTxDetails.fromCoin.coin;
		const provider = auth.value.provider;
		const did = auth.value.did ?? '';
		const isHiveAsset =
			fromCoinDef.value === Coin.hive.value || fromCoinDef.value === Coin.hbd.value;
		const isBtcAsset = fromCoinDef.value === Coin.btc.value;
		// Reown now supports both EVM (eip155) and Bitcoin (bip122) via
		// the AppKit BitcoinAdapter; the resolved DID tells us which.
		const isReownBtc = provider === 'reown' && did.startsWith('did:pkh:bip122:');
		const isReownEvm = provider === 'reown' && did.startsWith('did:pkh:eip155:');

		if (provider === 'reown' && isHiveAsset) {
			setError('HIVE/HBD requires a Hive wallet — connect via Hive Keychain or HiveAuth');
			return false;
		}
		if (isReownEvm && isBtcAsset) {
			setError('Your EVM wallet cannot sign BTC — connect a Bitcoin wallet instead');
			return false;
		}
		return true;
	}

	async function requestSwap() {
		if (!validateSwap()) return;

		// Reown Bitcoin wallet + BTC source → take the deposit-address
		// flow instead of the normal review popup. The user sends BTC
		// from their own wallet (same pattern as BitcoinMainnetDeposit),
		// and the mapping bot's `swap_to` instruction routes it through
		// the DEX router on Magi so the recipient ends up with the
		// swapped `toCoin`.
		if (
			auth.value?.provider === 'reown' &&
			auth.value.did?.startsWith('did:pkh:bip122:') &&
			$SendTxDetails.fromCoin?.coin.value === Coin.btc.value
		) {
			btcDepositAddress = null;
			btcDepositError = null;
			btcDepositToggle(true);
			btcDepositLoading = true;
			try {
				const rawReceiver = $SendTxDetails.toUsername?.trim() ?? '';
				const normalizedReceiver = rawReceiver.startsWith('hive:')
					? rawReceiver
					: rawReceiver.startsWith('@')
						? `hive:${rawReceiver.slice(1)}`
						: `hive:${rawReceiver}`;
				const toAsset = $SendTxDetails.toCoin!.coin.value;
				// Map the target coin to the chain the DEX router should
				// settle on. Without this the swapped funds stay in Magi
				// instead of being withdrawn to the user's mainnet wallet.
				const chainMap: Record<string, string> = {
					hive: 'HIVE',
					hbd: 'HIVE',
					btc: 'BTC'
				};
				const destinationChain = chainMap[toAsset] ?? 'MAGI';
				const instructionParams = new URLSearchParams({
					swap_to: normalizedReceiver,
					swap_asset_out: toAsset,
					destination_chain: destinationChain
				});
				const res = await fetch('/api/mapping-bot', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						instruction: instructionParams.toString(),
						network: isVscTestnet() ? 'testnet' : 'mainnet'
					})
				});
				if (!res.ok) {
					const text = await res.text();
					throw new Error(`Mapping bot error (${res.status}): ${text}`);
				}
				const { address } = (await res.json()) as { address: string };
				if (!address) throw new Error('Mapping bot returned no address');
				btcDepositAddress = address;
			} catch (err) {
				btcDepositError = err instanceof Error ? err.message : String(err);
			} finally {
				btcDepositLoading = false;
			}
			return;
		}

		reviewOpen = true;
	}

	/**
	 * Try to auto-send the BTC transfer via the connected wallet's
	 * own sendTransfer RPC. May fail if the wallet's internal UI is
	 * unable to render (e.g. Leather's testnet3 fee API returning
	 * 500); if it does, the user can still copy the address and
	 * send manually from their wallet's main Send flow.
	 */
	async function sendBtcViaConnectedWallet() {
		if (!btcDepositAddress) return;
		btcDepositError = null;
		swapStatus = 'Waiting for Bitcoin wallet approval…';
		try {
			const { sendBtcFromConnectedWallet } =
				await import('$lib/magiTransactions/bitcoin/walletSend');
			const satsAmount = new CoinAmount($SendTxDetails.fromAmount ?? '0', Coin.btc).amount;
			const txHash = await sendBtcFromConnectedWallet({
				amountSats: satsAmount,
				recipient: btcDepositAddress,
				fallbackAddress: auth.value?.address
			});
			swapStatus = `BTC sent: ${txHash}`;
			btcDepositToggle(false);
		} catch (err) {
			btcDepositError = err instanceof Error ? err.message : String(err);
		} finally {
			swapStatus = '';
		}
	}

	function cancelSwap() {
		if (swapLoading) return; // can't cancel mid-broadcast from here
		reviewOpen = false;
	}

	async function confirmSwap() {
		if (!auth.value || !$SendTxDetails.fromCoin || !$SendTxDetails.toCoin) return;

		const fromCoinDef = $SendTxDetails.fromCoin.coin;
		const toCoinDef = $SendTxDetails.toCoin.coin;
		const amount = new CoinAmount($SendTxDetails.fromAmount, fromCoinDef);
		const caller = auth.value.did;

		// QuickSwap is mainnet→mainnet: the DEX router must settle
		// the swapped output back to an external chain, not leave it
		// in Magi. Derive the destination chain from the target coin.
		const destChainMap: Record<string, string> = {
			hive: 'HIVE',
			hbd: 'HIVE',
			btc: 'BTC'
		};
		const destinationChain = destChainMap[toCoinDef.value] ?? '';
		const swapReceiver = $SendTxDetails.toUsername?.trim() ?? '';
		// For Hive targets, prefix with "hive:" if not already
		const routerRecipient =
			destinationChain === 'HIVE' && !swapReceiver.startsWith('hive:')
				? `hive:${swapReceiver.replace(/^@/, '')}`
				: swapReceiver;
		if (destinationChain && destinationChain !== 'MAGI' && !routerRecipient) {
			setError('Enter a receiver address for the target chain');
			swapLoading = false;
			return;
		}

		swapError = false;
		swapStatus = '';
		swapLoading = true;

		try {
			let txId: string;

			if (auth.value.provider === 'aioha' && auth.value.aioha) {
				// Hive wallet path
				const username = auth.value.username ?? getUsernameFromAuth(auth);
				if (!username) throw new Error('Could not resolve username');

				const ops = [];
				const isNativeIn =
					fromCoinDef.value === Coin.hive.value || fromCoinDef.value === Coin.hbd.value;

				if (fromCoinDef.value === Coin.btc.value) {
					ops.push(getBtcApproveOp(username, amount as CoinAmount<typeof Coin.btc>));
				} else if (isNativeIn) {
					// Deposit HIVE/HBD from L1 into Magi first.
					// HiveDraw in the router pulls from the caller's
					// Magi balance, not L1 — so the funds must be on
					// the Magi ledger before the swap contract call.
					ops.push(
						getHiveDepositOp(
							username,
							`hive:${username}`,
							amount as CoinAmount<typeof Coin.hive | typeof Coin.hbd>
						)
					);
				}
				const minOut = $SendTxDetails.minAmountOut
					? Number($SendTxDetails.minAmountOut)
					: undefined;
				ops.push(
					await getHiveSwapOp(
						username,
						amount,
						fromCoinDef as typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc,
						toCoinDef as typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc,
						minOut,
						destinationChain || undefined,
						routerRecipient || undefined
					)
				);

				swapStatus = 'Waiting for wallet approval...';
				const res = await executeTx(auth.value.aioha, ops);
				if (!res.success) throw new Error(res.error || 'Swap failed');
				txId = res.result;
			} else {
				// EVM reown wallet path (no BTC reown since BTC is
				// handled above).
				const feeQualifies =
					ALTERA_FEE_ACTIVE &&
					(await qualifiesForAlteraFee(
						amount as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>,
						toCoinDef as typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc,
						destinationChain || undefined
					));
				const storeMin = $SendTxDetails.minAmountOut;
				// Contract validates min_amount_out AFTER altera deduction,
				// so scale the store's pre-fee min down by the same bps.
				const finalMin =
					feeQualifies && storeMin
						? String(Math.floor((Number(storeMin) * (10000 - ALTERA_FEE_BPS)) / 10000))
						: (storeMin ?? '0');
				const swapInstruction: Record<string, string | number> = {
					type: 'swap',
					version: '1.0.0',
					asset_in: fromCoinDef.value.toUpperCase(),
					asset_out: toCoinDef.value.toUpperCase(),
					amount_in: String(amount.amount),
					min_amount_out: finalMin,
					// Recipient is the user-entered target-chain address
					// (already normalised into routerRecipient above). Only
					// falls back to the Magi caller when the swap stays on
					// Magi (no destination_chain).
					recipient: routerRecipient || (destinationChain ? '' : caller)
				};
				if (destinationChain) {
					swapInstruction.destination_chain = destinationChain;
				}
				if (feeQualifies) {
					swapInstruction.beneficiary = ALTERA_FEE_BENEFICIARY;
					swapInstruction.ref_bps = ALTERA_FEE_BPS;
				}
				const swapPayload: CallContractTransaction = {
					op: 'call',
					payload: {
						contract_id: SWAP_CONTRACT_ID,
						action: 'execute',
						payload: JSON.stringify(swapInstruction),
						rc_limit: 10000,
						intents: [],
						caller
					}
				};

				const txOps: CallContractTransaction[] = [swapPayload];

				if (!wagmiConfig) {
					setError('Connect an EVM wallet first');
					return;
				}
				const client = createClient(caller);
				swapStatus = 'Waiting for wallet approval...';
				const res = await signAndBrodcastTransaction(
					txOps,
					wagmiSigner,
					client,
					undefined,
					wagmiConfig
				);
				txId = res.id;
			}

			swapStatus = 'Swap submitted!';
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount($SendTxDetails.toAmount || '0', toCoinDef).toAmountString(),
							asset: toCoinDef.unit.toLowerCase(),
							from: caller,
							to: caller,
							memo: '',
							type: 'swap'
						},
						type: 'swap',
						index: 0
					}
				],
				timestamp: new Date(),
				id: txId,
				type: auth.value.provider === 'aioha' ? 'hive' : 'evm'
			});
			// Close the confirm popup on successful broadcast.
			reviewOpen = false;
		} catch (e: any) {
			swapStatus = e.message || 'Swap failed';
			swapError = true;
		} finally {
			swapLoading = false;
		}
	}
</script>

<div class="swap-card dashboard-card">
	<!-- Header -->
	<div class="swap-header">
		<div class="swap-badge">
			<span class="swap-dot"></span>
			<span class="swap-badge-text">MAGI CROSS-CHAIN</span>
		</div>
		<p class="swap-subtitle">Swap native assets across blockchains</p>
		<div class="powered-by">
			<span>Powered by</span>
			<img src="/magi.svg" alt="Magi" class="magi-logo" />
		</div>
	</div>

	<!-- From Field -->
	<div class="swap-field">
		<div class="field-top">
			<span class="field-label">From:</span>
			<span class="network-tag">mainnet</span>
			<button
				type="button"
				class="token-select"
				onclick={(e) => {
					e.stopPropagation();
					openDialog('from');
				}}
			>
				{#if $SendTxDetails.fromCoin}
					<img src={$SendTxDetails.fromCoin.coin.icon} alt="" class="token-img" />
					<span class="token-name">{$SendTxDetails.fromCoin.coin.label}</span>
				{:else}
					<span class="token-name muted">Select token</span>
				{/if}
				<ChevronDown size={12} />
			</button>
		</div>
		<div class="input-wrap">
			<AmountInput
				bind:coinAmount={inputAmount}
				coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
				{minAmount}
				{maxAmount}
				styleType="simple"
				hideUnit
				hideNetwork
			/>
		</div>
		{#if maxAmount}
			<div class="balance-row">
				<span class="balance-label"
					>Balance: {maxAmount.toPrettyAmountString()}
					{$SendTxDetails.fromCoin?.coin.label ?? ''}</span
				>
				<button type="button" class="max-btn" onclick={() => (inputAmount = maxAmount!)}>
					Max
				</button>
			</div>
		{/if}
	</div>

	<!-- Divider arrow -->
	<div class="swap-arrow-wrap" aria-hidden="true">
		<div class="swap-arrow-icon">
			<ArrowDown size={14} />
		</div>
	</div>

	<!-- To Field -->
	<div class="swap-field to-field">
		<div class="field-top">
			<span class="field-label">To:</span>
			<span class="network-tag">mainnet</span>
			<button type="button" class="token-select" onclick={() => openDialog('to')}>
				{#if $SendTxDetails.toCoin}
					<img src={$SendTxDetails.toCoin.coin.icon} alt="" class="token-img" />
					<span class="token-name">{$SendTxDetails.toCoin.coin.label}</span>
				{:else}
					<span class="token-name muted">Select token</span>
				{/if}
				<ChevronDown size={12} />
			</button>
		</div>
		<div class="input-wrap">
			<AmountInput
				bind:coinAmount={toInputAmount}
				coinOpts={toOnlyCoinOpts.length > 0 ? toOnlyCoinOpts : possibleCoins}
				styleType="simple"
				hideUnit
				hideNetwork
			/>
		</div>
	</div>

	<!-- Receiver -->
	<div class="receiver-field">
		<label for="quickswap-receiver" class="field-label">Receiver *</label>
		<div class="receiver-input-wrap" class:error={missingReceiver && hasAmount}>
			<input
				id="quickswap-receiver"
				type="text"
				required
				bind:value={$SendTxDetails.toUsername}
				placeholder="username or address"
				autocomplete="off"
				spellcheck="false"
			/>
		</div>
	</div>

	<!-- Slippage -->
	<div class="slippage-row">
		<span class="field-label">Slippage</span>
		<div class="slippage-options">
			{#each slippageOptions as bps}
				<button
					type="button"
					class:active={slippageBps === bps && !customSlippageOpen}
					onclick={() => {
						slippageBps = bps;
						customSlippageOpen = false;
					}}
				>
					{(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
				</button>
			{/each}
			{#if customSlippageOpen}
				<div class="custom-slippage">
					<input
						bind:this={customSlippageInputEl}
						type="text"
						inputmode="decimal"
						placeholder="0.5"
						bind:value={customSlippageInput}
						oninput={() => {
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
					<span>%</span>
				</div>
			{:else}
				<button
					type="button"
					class:active={!slippageOptions.includes(slippageBps)}
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

	<!-- Swap Details -->
	{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
		<div class="swap-details">
			<div class="detail-row">
				<span class="detail-label">Rate</span>
				<span class="detail-value"
					>{fromInTo ? `1 ${$SendTxDetails.fromCoin.coin.label} ≈ ${fromInTo}` : '—'}</span
				>
			</div>
			<div class="detail-row">
				<span class="detail-label">
					Protocol fee
					<span class="detail-sublabel">({swapResult?.hop1Fee ? '0.16%' : '0.08%'})</span>
				</span>
				<span class="detail-value">
					{#if totalProtocolFeeUsd !== null}
						≈ ${formatUsd(totalProtocolFeeUsd)}
					{:else}
						—
					{/if}
				</span>
			</div>
			{#if exchangeFeePct !== null}
				<div class="detail-row">
					<span class="detail-label"
						>Exchange fee <span class="detail-sublabel">(Altera)</span></span
					>
					<span
						class="detail-value"
						class:detail-free={exchangeFeePct === 0}
						class:detail-cost={exchangeFeePct > 0}
					>
						{exchangeFeePct === 0 ? 'Free' : `${exchangeFeePct}%`}
					</span>
				</div>
			{/if}
			<div class="detail-row">
				<span class="detail-label">Route</span>
				<span class="detail-value route">
					{$SendTxDetails.fromCoin.coin.label}
					→
					{#if $SendTxDetails.fromCoin.coin.value !== 'hbd' && $SendTxDetails.toCoin.coin.value !== 'hbd'}
						HBD →
					{/if}
					{$SendTxDetails.toCoin.coin.label}
				</span>
			</div>
			{#if swapResult && swapResult.minAmountOut > 0n && $SendTxDetails.toCoin}
				{@const toCoinDef = $SendTxDetails.toCoin.coin}
				{@const minOut = formatFee(swapResult.minAmountOut, toCoinDef.decimalPlaces)}
				<div class="detail-row">
					<span class="detail-label">Min amount received</span>
					<span class="detail-value">{minOut} {toCoinDef.unit}</span>
				</div>
			{/if}
			{#if swapResult && priceImpactPct > 0}
				<div class="detail-row">
					<span class="detail-label">Price Impact</span>
					<span
						class="detail-value impact-pct"
						class:good={priceImpactPct < 2}
						class:medium={priceImpactPct >= 2 && priceImpactPct < 10}
						class:bad={priceImpactPct >= 10}>{priceImpactPct.toFixed(2)}%</span
					>
				</div>
			{/if}
		</div>
	{/if}

	{#if priceImpactPct >= 10}
		<p class="swap-status error" class:severe={priceImpactPct >= 15}>
			{#if priceImpactPct >= 15}
				⚠ Very high price impact. Pool liquidity is low. Try a smaller amount.
			{:else}
				⚠ High price impact. Consider a smaller amount for better rates.
			{/if}
		</p>
	{/if}

	{#if sameCoinSelected}
		<p class="swap-status error">From and To assets must be different.</p>
	{:else if exceedsBalance}
		<p class="swap-status error">Amount exceeds your wallet balance.</p>
	{:else if exceedsPoolDepth}
		<p class="swap-status error">Amount exceeds 50% of pool depth — reduce the amount.</p>
	{/if}

	<!-- Exchange -->
	<PillButton
		onclick={requestSwap}
		disabled={swapLoading ||
			!hasAmount ||
			sameCoinSelected ||
			missingReceiver ||
			exceedsBalance ||
			exceedsPoolDepth}
		styleType="invert submit"
	>
		{swapLoading ? 'Swapping...' : 'Swap'}
	</PillButton>
	{#if swapStatus && !reviewOpen && !sameCoinSelected && !exceedsBalance}
		<p class="swap-status" class:error={swapError}>{swapStatus}</p>
	{/if}
</div>

<ReviewSwap
	popup
	isActive={reviewOpen}
	status={reviewStatus}
	waiting={swapLoading}
	abort={cancelSwap}
	previous={cancelSwap}
	next={confirmSwap}
	goHome={() => (reviewOpen = false)}
/>

<Dialog bind:open={btcDepositOpen} bind:toggle={btcDepositToggle}>
	{#snippet title()}Send Bitcoin{/snippet}
	{#snippet content()}
		<div class="btc-deposit">
			<p class="btc-deposit-intro">
				Send exactly the amount below to the address shown. The mapping bot observes the transaction
				and forwards the swap to <strong>{$SendTxDetails.toUsername ?? ''}</strong> as {$SendTxDetails
					.toCoin?.coin.label ?? ''} on Magi.
			</p>

			{#if btcDepositLoading}
				<p class="btc-deposit-loading">Requesting deposit address…</p>
			{:else if btcDepositError}
				<p class="btc-deposit-error">{btcDepositError}</p>
			{:else if btcDepositAddress}
				{#if btcDepositQr}
					<div class="btc-deposit-qr">
						<img src={btcDepositQr} alt="Deposit address QR code" width="220" height="220" />
						<span class="btc-deposit-qr-hint"
							>Scan with a Bitcoin wallet to prefill address &amp; amount</span
						>
					</div>
				{/if}
				<div class="btc-deposit-field">
					<span class="btc-deposit-label">Amount</span>
					<Clipboard
						value={new CoinAmount($SendTxDetails.fromAmount ?? '0', Coin.btc).toAmountString()}
						label="Amount (BTC)"
						disabled={false}
					/>
				</div>
				<div class="btc-deposit-field">
					<span class="btc-deposit-label">Deposit address</span>
					<Clipboard value={btcDepositAddress} label="Bitcoin address" disabled={false} />
				</div>

				<div class="btc-deposit-actions">
					<PillButton
						styleType="invert submit"
						onclick={sendBtcViaConnectedWallet}
						disabled={swapLoading}
					>
						Send with connected wallet
					</PillButton>
					<PillButton styleType="outline" onclick={() => btcDepositToggle(false)}>
						I'll send manually
					</PillButton>
				</div>
				{#if swapStatus}
					<p class="btc-deposit-status">{swapStatus}</p>
				{/if}
			{/if}
		</div>
	{/snippet}
</Dialog>

<Dialog bind:open={dialogOpen} bind:toggle>
	{#snippet title()}Select a token{/snippet}
	{#snippet content()}
		<div class="dialog-content">
			<div class="token-search-wrapper">
				<Search size={16} />
				<input bind:value={tokenSearch} placeholder="Search tokens..." />
			</div>
			<div class="token-chip-grid">
				{#each getFilteredTokens(currentlyOpen === 'from' ? fromAssetObjs : toAssetObjs) as token (token.value)}
					{@const disabled =
						currentlyOpen === 'from'
							? !isFromTokenAllowed(token.value)
							: !isToTokenAllowed(token.value)}
					{@const disabledReason =
						currentlyOpen === 'from'
							? 'Not supported by your connected wallet'
							: 'Already selected as source'}
					<button
						class="token-chip"
						class:disabled
						{disabled}
						onclick={() => selectToken(token)}
						title={disabled ? disabledReason : undefined}
					>
						<img src={token.icon} alt={token.label} class="chip-icon" />
						<span>{coinDisplayLabel(token)}</span>
					</button>
				{/each}
			</div>
		</div>
	{/snippet}
</Dialog>

<style lang="scss">
	.swap-card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		padding: 1.25rem;
		box-shadow: var(--dash-card-shadow);
	}

	/* Header */
	.swap-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.swap-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.75rem;
		border: 1px solid rgba(111, 106, 248, 0.25);
		border-radius: 2rem;
	}
	.swap-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #4ade80;
		box-shadow: 0 0 6px 1px rgba(74, 222, 128, 0.5);
		animation: dot-pulse 2s ease-in-out infinite;
	}
	@keyframes dot-pulse {
		0%,
		100% {
			box-shadow: 0 0 4px 1px rgba(74, 222, 128, 0.3);
		}
		50% {
			box-shadow: 0 0 10px 3px rgba(74, 222, 128, 0.7);
		}
	}
	.swap-badge-text {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--dash-text-primary);
	}
	.swap-subtitle {
		font-size: 0.75rem;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		margin: 0;
	}
	.powered-by {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.15rem;
		span {
			font-size: 0.75rem;
			color: var(--dash-text-muted);
			font-family: 'Nunito Sans', sans-serif;
		}
		.magi-logo {
			height: 20px;
			width: auto;
		}
	}

	/* Fields */
	.swap-field {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		padding: 0.875rem 1rem;
	}
	.to-field {
		cursor: default;
	}
	.field-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.field-label {
		color: var(--dash-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.network-tag {
		margin-left: auto;
		margin-right: 0.5rem;
		padding: 0.2rem 0.55rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--dash-text-muted);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.swap-arrow-wrap {
		display: flex;
		justify-content: center;
		margin: -0.35rem 0;
		position: relative;
		z-index: 1;
		pointer-events: none;
	}
	.swap-arrow-icon {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--dash-card-bg);
		border: 1px solid rgba(111, 106, 248, 0.35);
		color: var(--dash-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.receiver-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}
	.balance-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.375rem;
		padding: 0 0.25rem;
	}
	.balance-label {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
	}
	.max-btn {
		padding: 0.15rem 0.5rem;
		border: 1px solid rgba(111, 106, 248, 0.35);
		border-radius: 12px;
		background: transparent;
		color: var(--dash-text-secondary);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.max-btn:hover {
		background: rgba(111, 106, 248, 0.15);
		color: var(--dash-text-primary);
		border-color: var(--dash-accent-purple);
	}
	.receiver-input-wrap {
		display: flex;
		align-items: center;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		padding: 0.875rem 1rem;
	}
	.receiver-input-wrap.error {
		border-color: var(--dash-accent-red, #e2595b);
	}
	.receiver-input-wrap input {
		flex: 1;
		background: none;
		border: none;
		color: var(--dash-text-primary);
		font: inherit;
		font-size: 0.85rem;
		min-width: 0;
	}
	.receiver-input-wrap input:focus {
		outline: none;
	}
	.receiver-input-wrap input::placeholder {
		color: var(--dash-text-muted);
	}
	.slippage-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.slippage-options {
		display: flex;
		gap: 0.25rem;
	}
	.slippage-options button {
		padding: 0.25rem 0.55rem;
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
	}
	.slippage-options button.active {
		background-color: var(--dash-accent-purple);
		color: var(--dash-text-primary);
		border-color: var(--dash-accent-purple);
	}
	.slippage-options button:hover:not(.active) {
		background-color: var(--dash-card-border);
	}
	.custom-slippage {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		border: 1px solid var(--dash-accent-purple);
		border-radius: 12px;
		padding: 0.15rem 0.4rem;
		background: transparent;
	}
	.custom-slippage input {
		width: 3rem;
		height: auto;
		border: none;
		background: transparent;
		color: var(--dash-text-primary);
		font-size: var(--text-xs);
		font-weight: 500;
		outline: none;
		text-align: right;
		-moz-appearance: textfield;
	}
	.custom-slippage input::-webkit-inner-spin-button,
	.custom-slippage input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.custom-slippage span {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
	}
	.btc-deposit {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 22rem;
		max-width: 28rem;
	}
	.btc-deposit-intro {
		color: var(--dash-text-secondary);
		font-size: 0.85rem;
		line-height: 1.4;
		margin: 0;
	}
	.btc-deposit-loading,
	.btc-deposit-status {
		color: var(--dash-text-muted);
		font-size: 0.8rem;
		margin: 0;
	}
	.btc-deposit-error {
		color: var(--dash-accent-red, #e2595b);
		font-size: 0.8rem;
		margin: 0;
	}
	.btc-deposit-qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0 0.5rem;
		img {
			background: rgba(255, 255, 255, 0.04);
			border: 1px solid var(--dash-card-border);
			border-radius: 16px;
			padding: 0.75rem;
		}
	}
	.btc-deposit-qr-hint {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		text-align: center;
	}
	.btc-deposit-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.btc-deposit-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dash-text-muted);
	}
	.btc-deposit-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.input-wrap {
		min-height: 42.2px;
	}

	/* Token selector */
	.token-select {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(111, 106, 248, 0.35);
		border-radius: 2rem;
		color: white;
		cursor: pointer;
		white-space: nowrap;
		font-family: inherit;
		&:hover {
			border-color: #6f6af8;
			background: rgba(111, 106, 248, 0.1);
		}
	}
	.token-img {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
	}
	.token-name {
		font-weight: 700;
		font-size: 0.8rem;
		&.muted {
			color: var(--dash-text-muted);
		}
	}

	/* Swap details */
	.swap-details {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem 0 0.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		margin-top: 0.5rem;
	}
	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1px;
	}
	.detail-label {
		color: var(--dash-text-muted);
		font-size: 0.7rem;
	}
	.detail-value {
		color: var(--dash-text-secondary);
		font-size: 0.7rem;
		font-weight: 500;
	}
	.detail-value.route {
		color: #6f6af8;
		font-weight: 600;
	}
	.detail-sublabel {
		font-size: 0.65rem;
		opacity: 0.7;
	}
	.detail-free {
		color: var(--dash-accent-green) !important;
	}
	.detail-cost {
		color: #f59e0b !important;
	}
	.field-usd-approx {
		display: block;
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		margin-top: 0.2rem;
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.impact-pct {
		font-weight: 600;
		&.good {
			color: var(--dash-success, #22c55e);
		}
		&.medium {
			color: var(--dash-warning, #f59e0b);
		}
		&.bad {
			color: var(--dash-error, #ef4444);
		}
	}

	.swap-status {
		text-align: center;
		font-size: var(--text-sm);
		color: var(--dash-accent-green);
		margin-top: 0.5rem;
		&.error {
			color: var(--dash-accent-red);
		}
	}

	/* ── Token Dialog ── */
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
		&.active {
			border-color: var(--dash-accent-purple);
			background-color: rgba(111, 106, 248, 0.15);
		}
		&.disabled,
		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
			&:hover {
				background-color: var(--dash-surface);
				border-color: var(--dash-card-border);
			}
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
</style>
