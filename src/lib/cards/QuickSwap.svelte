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
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { untrack } from 'svelte';
	import { ChevronDown, Search } from '@lucide/svelte';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import {
		fetchPoolDepths,
		findPoolByPair,
		calculateSwap,
		getOrderedDepths,
		type PoolDepths,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';
	import {
		getHiveSwapOp,
		getBtcApproveOp,
		SWAP_CONTRACT_ID
	} from '$lib/magiTransactions/hive/vscOperations/swap';
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
		const hiveToOption = swapOptions.to.coins.find((c) => c.coin.value === Coin.hive.value);
		const fromOpt = findFromOpt(stored?.fromCoin) ?? btcFromOption;
		const toOpt = findToOpt(stored?.toCoin) ?? hiveToOption;
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

	$effect(() => {
		if (auth.value && getUsernameFromAuth(auth)) {
			$SendTxDetails.toUsername = getUsernameFromAuth(auth)!;
		}
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
					fromInTo = amt.toPrettyMinFigs();
				});
		}
	});

	// Pool-based fee calculation — resolve the HIVE/HBD pool contract from the
	// indexer registry (network-aware) before fetching depths.
	let poolDepths: PoolDepths | null = $state(null);
	let swapResult: SwapCalcResult | null = $state(null);
	(async () => {
		const poolId = await findPoolByPair('HIVE', 'HBD');
		if (!poolId) return;
		const d = await fetchPoolDepths(poolId);
		if (d) poolDepths = d;
	})();

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
		const slippageBps = 100; // QuickSwap default 1%
		const result = calculateSwap(BigInt(fromAmountInt), X, Y, slippageBps);
		swapResult = result;

		// Mirror the swap calc into $SendTxDetails so ReviewSwap can read
		// the same numbers (fee, slippage, expected output) without
		// recomputing or showing a "loading…" placeholder.
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

	function selectToken(token: AssetObject) {
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
	const reviewStatus = $derived({ message: swapStatus, isError: swapError });
	const hasAmount = $derived(
		!!$SendTxDetails.fromAmount && $SendTxDetails.fromAmount !== '0' && inputAmount.amount > 0
	);
	const sameCoinSelected = $derived(
		!!$SendTxDetails.fromCoin &&
			!!$SendTxDetails.toCoin &&
			$SendTxDetails.fromCoin.coin.value === $SendTxDetails.toCoin.coin.value
	);

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

		const fromCoinDef = $SendTxDetails.fromCoin.coin;
		const provider = auth.value.provider;
		const isHiveAsset =
			fromCoinDef.value === Coin.hive.value || fromCoinDef.value === Coin.hbd.value;
		const isBtcAsset = fromCoinDef.value === Coin.btc.value;

		if (provider === 'reown' && isHiveAsset) {
			setError('HIVE/HBD requires a Hive wallet — connect via Hive Keychain or HiveAuth');
			return false;
		}
		if (provider === 'reown' && isBtcAsset) {
			setError('BTC requires a Bitcoin wallet — MetaMask cannot send BTC');
			return false;
		}
		if (provider === 'aioha' && isBtcAsset) {
			setError('BTC requires a Bitcoin mainnet wallet');
			return false;
		}
		return true;
	}

	function requestSwap() {
		if (!validateSwap()) return;
		reviewOpen = true;
	}

	/**
	 * Swap the from/to coins and carry the previous target amount across
	 * as the new origin amount.
	 *
	 * Tricky bit: AmountInput cross-binds inputAmount/toInputAmount via
	 * its `connectedCoinAmount` prop with async Lightning-rate conversion.
	 * Swapping both sides at once would ping-pong the convertTo effects
	 * forever and hang the browser. We work around that by:
	 *  1. Snapshotting the old to-amount value.
	 *  2. Zeroing both bound CoinAmounts so each AmountInput's
	 *     `lastConnected` settles on "0" without triggering a convertTo.
	 *  3. Swapping the coin/network selections in the store.
	 *  4. After a frame (so the connected effects pick up the zero state),
	 *     setting inputAmount to the carried-over value. Only one side
	 *     changes at a time, so the convertTo on the other side has a
	 *     stable target and no ping-pong.
	 */
	function flipDirection() {
		if (swapLoading) return;
		const fromCoinValue = $SendTxDetails.fromCoin?.coin.value;
		const toCoinValue = $SendTxDetails.toCoin?.coin.value;
		if (!fromCoinValue || !toCoinValue) return;

		const newFromOpt = swapOptions.from.coins.find((c) => c.coin.value === toCoinValue);
		const newToOpt = swapOptions.to.coins.find((c) => c.coin.value === fromCoinValue);
		if (!newFromOpt || !newToOpt) return;

		// Old to-side amount in smallest units of the OLD to coin, which
		// equals the NEW from coin (same currency, same decimals).
		const carryAmount = toInputAmount.amount;

		inputAmount = new CoinAmount(0, newFromOpt.coin);
		toInputAmount = new CoinAmount(0, newToOpt.coin);

		SendTxDetails.update((d) => ({
			...d,
			fromCoin: newFromOpt,
			toCoin: newToOpt,
			fromNetwork: nativeNetworkFor(newFromOpt.coin.value),
			toNetwork: nativeNetworkFor(newToOpt.coin.value),
			fromAmount: '0',
			toAmount: '0'
		}));

		if (carryAmount <= 0) return;

		// After both AmountInputs have settled on zero, set the new
		// from-side AND the converted to-side together in one RAF tick.
		// We do the conversion ourselves and apply both sides at once so
		// the AmountInputs' `connectedCoinAmount` effects see a stable,
		// already-converged pair on their next run — convergence check
		// short-circuits and no ping-pong fires.
		requestAnimationFrame(async () => {
			const newFromAmt = new CoinAmount(carryAmount, newFromOpt.coin, true);
			let newToAmt: CoinAmount<Coin>;
			try {
				newToAmt = (await newFromAmt.convertTo(
					newToOpt.coin,
					Network.lightning
				)) as CoinAmount<Coin>;
			} catch {
				newToAmt = new CoinAmount(0, newToOpt.coin);
			}
			inputAmount = newFromAmt;
			toInputAmount = newToAmt;
		});
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
				if (fromCoinDef.value === Coin.btc.value) {
					ops.push(getBtcApproveOp(username));
				}
				ops.push(
					getHiveSwapOp(
						username,
						amount,
						fromCoinDef as typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc,
						toCoinDef as typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc
					)
				);

				swapStatus = 'Waiting for wallet approval...';
				const res = await executeTx(auth.value.aioha, ops);
				if (!res.success) throw new Error(res.error || 'Swap failed');
				txId = res.result;
			} else {
				// EVM/Reown wallet path
				const swapPayload: CallContractTransaction = {
					op: 'call',
					payload: {
						contract_id: SWAP_CONTRACT_ID,
						action: 'execute',
						payload: JSON.stringify({
							type: 'swap',
							version: '1.0.0',
							asset_in: fromCoinDef.value.toUpperCase(),
							asset_out: toCoinDef.value.toUpperCase(),
							amount_in: String(amount.amount),
							min_amount_out: '0',
							recipient: caller
						}),
						rc_limit: 5000,
						intents: [],
						caller
					}
				};

				const txOps: CallContractTransaction[] = [];

				// BTC needs approval via mapping contract
				if (fromCoinDef.value === Coin.btc.value) {
					const { BTC_MAPPING_CONTRACT_ID } = await import('$lib/stores/currentBalance');
					txOps.push({
						op: 'call',
						payload: {
							contract_id: BTC_MAPPING_CONTRACT_ID,
							action: 'approve',
							payload: JSON.stringify({
								spender: `contract:${SWAP_CONTRACT_ID}`,
								amount: '999999999'
							}),
							rc_limit: 1000,
							intents: [],
							caller
						}
					});
				}

				txOps.push(swapPayload);

				swapStatus = 'Waiting for wallet approval...';
				const client = createClient(caller);
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

<div class="swap-card">
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
				connectedCoinAmount={toInputAmount}
				coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
				{minAmount}
				styleType="simple"
				hideUnit
				hideNetwork
			/>
		</div>
	</div>

	<!-- Swap arrow -->
	<div class="swap-arrow-wrap">
		<button
			type="button"
			class="swap-arrow-btn"
			onclick={flipDirection}
			disabled={swapLoading || !$SendTxDetails.fromCoin || !$SendTxDetails.toCoin}
			aria-label="Flip from/to">↕</button
		>
	</div>

	<!-- To Field -->
	<div class="swap-field to-field">
		<div class="field-top">
			<span class="field-label">To:</span>
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
				connectedCoinAmount={inputAmount}
				coinOpts={toOnlyCoinOpts.length > 0 ? toOnlyCoinOpts : possibleCoins}
				styleType="simple"
				hideUnit
				hideNetwork
			/>
		</div>
	</div>

	<!-- Swap Details -->
	{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
		<div class="swap-details">
			<div class="detail-row">
				<span class="detail-label">Rate</span>
				<span class="detail-value"
					>{fromInTo
						? `1 ${$SendTxDetails.fromCoin.coin.label} ≈ ${fromInTo} ${$SendTxDetails.toCoin.coin.label}`
						: '—'}</span
				>
			</div>
			<div class="detail-row">
				<span class="detail-label">Fee</span>
				<span class="detail-value">
					{#if swapResult && $SendTxDetails.fromCoin}
						{formatFee(swapResult.totalFee, $SendTxDetails.fromCoin.coin.decimalPlaces)}
						{$SendTxDetails.fromCoin.coin.label}
					{:else}
						0.08% + CLP
					{/if}
				</span>
			</div>
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
		</div>
	{/if}

	{#if sameCoinSelected}
		<p class="swap-status error">From and To assets must be different.</p>
	{/if}

	<!-- Exchange -->
	<PillButton
		onclick={requestSwap}
		disabled={swapLoading || !hasAmount || sameCoinSelected}
		styleType="invert submit"
	>
		{swapLoading ? 'Swapping...' : 'Swap'}
	</PillButton>
	{#if swapStatus && !reviewOpen && !sameCoinSelected}
		<p class="swap-status" class:error={swapError}>{swapStatus}</p>
	{/if}
</div>

<ReviewSwap
	isActive={reviewOpen}
	status={reviewStatus}
	waiting={swapLoading}
	abort={cancelSwap}
	previous={cancelSwap}
	next={confirmSwap}
/>

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
					<button class="token-chip" onclick={() => selectToken(token)}>
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

	/* Swap arrow */
	.swap-arrow-wrap {
		display: flex;
		justify-content: center;
		padding: 0.125rem 0;
	}
	.swap-arrow-btn {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--dash-text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		&:hover {
			border-color: #6f6af8;
			color: #6f6af8;
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
