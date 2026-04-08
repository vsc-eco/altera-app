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
		type CoinOnNetwork,
		type CoinOptions
	} from '$lib/sendswap/utils/sendOptions';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Dialog from '$lib/zag/Dialog.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { untrack } from 'svelte';
	import { ChevronDown, Search, ArrowLeft, X } from '@lucide/svelte';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import {
		fetchPoolDepths,
		calculateSwap,
		getOrderedDepths,
		type PoolDepths,
		type SwapCalcResult
	} from '$lib/pools/swapCalc';
	import { getHiveSwapOp, getBtcApproveOp, SWAP_CONTRACT_ID } from '$lib/magiTransactions/hive/vscOperations/swap';
	import { executeTx } from '$lib/magiTransactions/hive';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { createClient, signAndBrodcastTransaction, type CallContractTransaction } from '$lib/magiTransactions/eth/client';
	import { wagmiSigner } from '$lib/magiTransactions/eth/wagmi';
	import { wagmiConfig } from '$lib/auth/reown';

	const auth = $derived(getAuth()());

	function startDetails() {
		const btcFromOption = swapOptions.from.coins.find((c) => c.coin.value === Coin.btc.value);
		return {
			...blankDetails(),
			toNetwork: Network.magi,
			method: TransferMethod.lightningTransfer,
			fromCoin: btcFromOption ?? undefined,
			fromNetwork: btcFromOption ? Network.lightning : undefined
		};
	}

	let swapDetailsInitialized = $state(false);
	$effect(() => {
		if (!auth.value || swapDetailsInitialized) return;
		swapDetailsInitialized = true;
		SendTxDetails.set(startDetails());
	});

	// Ensure From is always BTC when not set (use swapOptions directly so it applies immediately)
	$effect(() => {
		if (!auth.value) return;
		if ($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork) return;
		const btcOption = swapOptions.from.coins.find((c) => c.coin.value === Coin.btc.value);
		if (btcOption) {
			$SendTxDetails.fromCoin = btcOption;
			$SendTxDetails.fromNetwork = Network.lightning;
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
		if (!optionsEqual(result.networkOptions, networkOptions)) networkOptions = result.networkOptions;
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


	$effect(() => {
		if ($SendTxDetails.toCoin && $SendTxDetails.toNetwork) return;
		const hiveOpt = swapOptions.to.coins.find((opt) => opt.coin.value === Coin.hive.value);
		if (hiveOpt) {
			$SendTxDetails.toCoin = hiveOpt;
			$SendTxDetails.toNetwork = Network.magi;
		}
	});

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

	// USD value for To field (AmountInput handles From USD internally)
	let toUsd = $state('');
	$effect(() => {
		const amt = parseFloat($SendTxDetails.toAmount || '0');
		if (!$SendTxDetails.toCoin || amt === 0) { toUsd = ''; return; }
		new CoinAmount(amt, $SendTxDetails.toCoin.coin)
			.convertTo(Coin.usd, Network.lightning)
			.then((usd) => { toUsd = `≈ $${usd.toPrettyAmountString()}`; })
			.catch(() => { toUsd = ''; });
	});

	// Pool-based fee calculation
	let poolDepths: PoolDepths | null = $state(null);
	let swapResult: SwapCalcResult | null = $state(null);
	fetchPoolDepths().then((d) => { if (d) poolDepths = d; });

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
		if (!isHiveSwap) { swapResult = null; return; }

		const fromAmountInt = new CoinAmount(fromAmount, fromCoin.coin).amount;
		if (!Number.isFinite(fromAmountInt) || fromAmountInt <= 0) { swapResult = null; return; }

		const assetIn = fromCoin.coin.value as 'hive' | 'hbd';
		const { X, Y } = getOrderedDepths(poolDepths, assetIn);
		swapResult = calculateSwap(BigInt(fromAmountInt), X, Y, 100);
	});

	function formatFee(val: bigint | number, decimals: number): string {
		const n = Number(val) / Math.pow(10, decimals);
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
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
	let dialogStep: 'tokens' | 'source' = $state('tokens');
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
		tempCoinOpt = coinOpt;

		if (currentlyOpen === 'from') {
			dialogStep = 'source';
		} else {
			SendTxDetails.update((d) => ({ ...d, toCoin: coinOpt, toNetwork: Network.magi }));
			closeDialog();
		}
	}

	function confirmFromSelection(coinOpt: CoinOptions['coins'][number], network: typeof Network[keyof typeof Network]) {
		SendTxDetails.update((d) => ({ ...d, fromCoin: coinOpt, fromNetwork: network }));
		closeDialog();
	}

	let swapStatus = $state('');
	let swapLoading = $state(false);
	let swapError = $state(false);

	async function onExchange() {
		swapError = false;
		swapStatus = '';

		if (!auth.value) {
			swapStatus = 'Connect your wallet first';
			swapError = true;
			return;
		}
		if (!$SendTxDetails.fromCoin || !$SendTxDetails.toCoin) {
			swapStatus = 'Select both tokens';
			swapError = true;
			return;
		}
		if (!$SendTxDetails.fromAmount || $SendTxDetails.fromAmount === '0') {
			swapStatus = 'Enter an amount';
			swapError = true;
			return;
		}

		const fromCoinDef = $SendTxDetails.fromCoin.coin;
		const toCoinDef = $SendTxDetails.toCoin.coin;
		const amount = new CoinAmount($SendTxDetails.fromAmount, fromCoinDef);
		const caller = auth.value.did;
		const provider = auth.value.provider;

		// Wallet/token compatibility check — QuickSwap is mainnet to mainnet
		const isHiveAsset = fromCoinDef.value === Coin.hive.value || fromCoinDef.value === Coin.hbd.value;
		const isBtcAsset = fromCoinDef.value === Coin.btc.value;

		if (provider === 'reown' && isHiveAsset) {
			swapStatus = 'HIVE/HBD requires a Hive wallet — connect via Hive Keychain or HiveAuth';
			swapError = true;
			return;
		}
		if (provider === 'reown' && isBtcAsset) {
			swapStatus = 'BTC requires a Bitcoin wallet — MetaMask cannot send BTC';
			swapError = true;
			return;
		}
		if (provider === 'aioha' && isBtcAsset) {
			swapStatus = 'BTC requires a Bitcoin mainnet wallet';
			swapError = true;
			return;
		}

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
					const { MAPPINGCONTRACTID } = await import('$lib/stores/currentBalance');
					txOps.push({
						op: 'call',
						payload: {
							contract_id: MAPPINGCONTRACTID,
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
				ops: [{
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
				}],
				timestamp: new Date(),
				id: txId,
				type: auth.value.provider === 'aioha' ? 'hive' : 'evm'
			});

		} catch (e: any) {
			swapStatus = e.message || 'Swap failed';
			swapError = true;
		} finally {
			swapLoading = false;
		}
	}


	const toAmountDisplay = $derived.by(() => {
		const amt = $SendTxDetails.toAmount;
		if (!amt || amt === '0') return '0.00';
		const n = parseFloat(amt);
		if (Number.isNaN(n)) return amt;
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
	});
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
			<button type="button" class="token-select" onclick={(e) => { e.stopPropagation(); openDialog('from'); }}>
				{#if $SendTxDetails.fromCoin}
					<img src={$SendTxDetails.fromCoin.coin.icon} alt="" class="token-img" />
					<span class="token-name">{$SendTxDetails.fromCoin.coin.label}</span>
				{:else}
					<span class="token-name muted">Select token</span>
				{/if}
				<ChevronDown size={12} />
			</button>
		</div>
		<div class="from-input-wrap">
			<AmountInput
				bind:coinAmount={inputAmount}
				coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
				{minAmount}
				borderless
				hideUnit
				hideNetwork
			/>
		</div>
	</div>

	<!-- Swap arrow -->
	<div class="swap-arrow-wrap">
		<button type="button" class="swap-arrow-btn">↕</button>
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
		<span class="output-amount">{toAmountDisplay}</span>
		{#if toUsd}
			<span class="usd-value">{toUsd}</span>
		{/if}
	</div>

	<!-- Swap Details -->
	{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
		<div class="swap-details">
			<div class="detail-row">
				<span class="detail-label">Rate</span>
				<span class="detail-value">{fromInTo ? `1 ${$SendTxDetails.fromCoin.coin.label} ≈ ${fromInTo} ${$SendTxDetails.toCoin.coin.label}` : '—'}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Fee</span>
				<span class="detail-value">
					{#if swapResult && $SendTxDetails.fromCoin}
						{formatFee(swapResult.totalFee, $SendTxDetails.fromCoin.coin.decimalPlaces)} {$SendTxDetails.fromCoin.coin.label}
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

	<!-- Exchange -->
	<button
		type="button"
		class="exchange-btn"
		onclick={onExchange}
		disabled={swapLoading}
	>
		{swapLoading ? 'Swapping...' : 'Swap'}
	</button>
	{#if swapStatus}
		<p class="swap-status" class:error={swapError}>{swapStatus}</p>
	{/if}
</div>

<Dialog bind:open={dialogOpen} bind:toggle>
	{#snippet content()}
		{#if dialogStep === 'tokens'}
			<div class="dialog-content">
				<div class="dialog-title-row">
					<h5>Select a token</h5>
					<button class="dialog-close-btn" onclick={closeDialog}><X size={20} /></button>
				</div>
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
			<div class="dialog-content">
				<div class="dialog-title-row">
					<button
						class="dialog-back-btn"
						onclick={() => {
							dialogStep = 'tokens';
							tempCoinOpt = undefined;
						}}
					>
						<ArrowLeft size={18} />
					</button>
					<h5>Select a token</h5>
					<button class="dialog-close-btn" onclick={closeDialog}><X size={20} /></button>
				</div>
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
					{#each tempCoinOpt.networks.filter(n => n.value !== Network.lightning.value) as net (net.value)}
						<button class="network-card" onclick={() => confirmFromSelection(tempCoinOpt!, net)}>
							<img src={tempCoinOpt.coin.icon} alt="" class="network-card-icon" />
							<div class="network-card-info">
								<span class="network-card-name">{net.value === Network.magi.value ? 'Magi Network' : 'Mainnet'}</span>
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
		background: #4ADE80;
		box-shadow: 0 0 6px 1px rgba(74, 222, 128, 0.5);
		animation: dot-pulse 2s ease-in-out infinite;
	}
	@keyframes dot-pulse {
		0%, 100% { box-shadow: 0 0 4px 1px rgba(74, 222, 128, 0.3); }
		50% { box-shadow: 0 0 10px 3px rgba(74, 222, 128, 0.7); }
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
	.from-input-wrap {
		margin: 0 -0.25rem;
	}
	.usd-value {
		display: block;
		color: var(--dash-text-muted);
		font-size: 0.7rem;
		margin-top: 0.25rem;
	}
	.output-amount {
		color: white;
		font-size: 1.25rem;
		font-weight: 600;
		font-family: 'Nunito Sans', sans-serif;
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
			border-color: #6F6AF8;
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
		&.muted { color: var(--dash-text-muted); }
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
			border-color: #6F6AF8;
			color: #6F6AF8;
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
		color: #6F6AF8;
		font-weight: 600;
	}

	/* Exchange */
	.exchange-btn {
		width: 100%;
		height: 44px;
		border: none;
		border-radius: 1.25rem;
		background: linear-gradient(135deg, #7B74FF 0%, #6F6AF8 40%, #5B54E0 100%);
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
		font-family: inherit;
		cursor: pointer;
		margin-top: 0.5rem;
		box-shadow: 0 4px 16px rgba(111, 106, 248, 0.25);
		&:hover {
			box-shadow: 0 6px 24px rgba(111, 106, 248, 0.4);
		}
		&:active {
			transform: scale(0.97);
		}
	}

	.swap-status {
		text-align: center;
		font-size: var(--text-sm);
		color: var(--dash-accent-green);
		margin-top: 0.5rem;
		&.error { color: var(--dash-accent-red); }
	}
	.exchange-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* ── Token Dialog ── */
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
			color: var(--dash-text-primary);
		}
	}
	.dialog-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--dash-text-muted);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 50%;
		transition: color 0.15s ease;
		&:hover { color: var(--dash-text-primary); }
	}
	.dialog-back-btn {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--dash-text-muted);
		cursor: pointer;
		padding: 0.25rem 0.5rem 0.25rem 0;
		transition: color 0.15s ease;
		&:hover { color: var(--dash-text-primary); }
	}
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
			&::placeholder { color: var(--dash-text-muted); }
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
		transition: background-color 0.15s ease, border-color 0.15s ease;
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
		transition: border-color 0.15s ease, background-color 0.15s ease;
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
		.network-card-name { font-weight: 500; }
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
