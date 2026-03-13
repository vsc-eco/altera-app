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
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';

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
	// To list: only show coins that have Magi balance (HIVE/HBD when available)
	const toCoinsWithBalance = $derived.by(() =>
		swapOptions.to.coins.filter((opt) => {
			const key = opt.coin.value as keyof AccountBalance;
			const bal = $accountBalance.bal?.[key];
			return Number(bal) > 0;
		})
	);
	const toAssetObjs: AssetObject[] = $derived.by(() =>
		toCoinsWithBalance.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.toNetwork, size: 'medium' }
		}))
	);

	// Clear To selection if current coin is no longer in Magi balance
	$effect(() => {
		if (!$SendTxDetails.toCoin) return;
		const stillAvailable = toCoinsWithBalance.some(
			(opt) => opt.coin.value === $SendTxDetails.toCoin?.coin.value
		);
		if (!stillAvailable) {
			const first = toCoinsWithBalance[0];
			if (first) {
				$SendTxDetails.toCoin = first;
				$SendTxDetails.toNetwork = Array.isArray(first.networks) ? first.networks[0] : undefined;
			} else {
				$SendTxDetails.toCoin = undefined;
				$SendTxDetails.toNetwork = undefined;
			}
		}
	});

	$effect(() => {
		// Default TO: HIVE if Magi balance available, else HBD (HIVE has priority)
		const hiveBal = $accountBalance.bal?.hive != null ? Number($accountBalance.bal.hive) : 0;
		const hbdBal = $accountBalance.bal?.hbd != null ? Number($accountBalance.bal.hbd) : 0;
		const hasHiveValue = hiveBal > 0;
		const hasHbdValue = hbdBal > 0;

		if (!($SendTxDetails.toCoin && $SendTxDetails.toNetwork)) {
			let nextToCoin: CoinOptions['coins'][number] | undefined,
				nextToNetwork: Network | undefined;
			if (hasHiveValue) {
				const swapTo = swapOptions.to.coins.find((opt) => opt.coin.value === Coin.hive.value);
				if (swapTo) {
					nextToCoin = swapTo;
					nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
				}
			} else if (hasHbdValue) {
				const swapTo = swapOptions.to.coins.find((opt) => opt.coin.value === Coin.hbd.value);
				if (swapTo) {
					nextToCoin = swapTo;
					nextToNetwork = Array.isArray(swapTo.networks) ? swapTo.networks[0] : undefined;
				}
			}
			const changed =
				$SendTxDetails.toCoin?.coin.value !== nextToCoin?.coin.value ||
				$SendTxDetails.toNetwork?.value !== nextToNetwork?.value;
			if (changed) {
				$SendTxDetails.toCoin = nextToCoin;
				$SendTxDetails.toNetwork = nextToNetwork;
			}
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
	function openDialog(state: 'from' | 'to') {
		currentlyOpen = state;
		toggle(true);
	}

	function onExchange() {
		goto('/swap');
	}

	const fromSubtitle = $derived(
		$SendTxDetails.fromNetwork ? `On ${$SendTxDetails.fromNetwork.label}` : 'Select source'
	);
	const toBalanceStr = $derived.by(() => {
		if (!$SendTxDetails.toCoin || $SendTxDetails.toNetwork?.value !== Network.magi.value) return '';
		const bal = $accountBalance.bal?.[$SendTxDetails.toCoin.coin.value as keyof AccountBalance];
		if (bal == null) return '';
		return new CoinAmount(bal, $SendTxDetails.toCoin.coin, true).toPrettyAmountString();
	});
	const toSubtitle = $derived.by(() => {
		if (!$SendTxDetails.toCoin) return 'Select destination';
		const parts: string[] = [];
		parts.push(
			`From ${$SendTxDetails.toCoin.networks.length} network${$SendTxDetails.toCoin.networks.length !== 1 ? 's' : ''}`
		);
		if (toBalanceStr) parts.push(`${toBalanceStr} on Magi`);
		else parts.push('On Magi');
		return parts.join(' • ');
	});

	const toAmountDisplay = $derived.by(() => {
		const amt = $SendTxDetails.toAmount;
		if (!amt || amt === '0') return '0.00';
		const n = parseFloat(amt);
		if (Number.isNaN(n)) return amt;
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
	});
</script>

<div class="swap-card">
	<div class="swap-header">
		<span class="status-dot"></span>
		<span class="swap-title">MAGI CROSS-CHAIN</span>
	</div>

	<div class="swap-body">
		<!-- From Section -->
		<div class="swap-section from-section">
			<div class="section-top">
				<span class="section-label">From</span>
				<span class="network-badge">Magi Network</span>
				<span class="balance-info">
					Balance: {toBalanceStr || '0'} {$SendTxDetails.fromCoin?.coin.label || ''}
				</span>
			</div>
			<div class="swap-input-row">
				<div class="amount-input-wrap">
					<AmountInput
						bind:coinAmount={inputAmount}
						coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
						{minAmount}
						styleType="normal"
					/>
				</div>
				<button type="button" class="token-selector" onclick={() => openDialog('from')}>
					{#if $SendTxDetails.fromCoin}
						<img
							src={$SendTxDetails.fromCoin.coin.icon}
							alt={$SendTxDetails.fromCoin.coin.label}
							class="token-icon"
						/>
						<div class="token-info">
							<span class="token-symbol">{$SendTxDetails.fromCoin.coin.label}</span>
							<span class="token-name">{$SendTxDetails.fromCoin.coin.label}</span>
						</div>
					{:else}
						<span class="placeholder">Select</span>
					{/if}
					<ChevronDown size={14} />
				</button>
			</div>
		</div>

		<!-- Swap Arrow -->
		<div class="swap-arrow-wrap">
			<button type="button" class="swap-arrow-btn" aria-label="Swap direction">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M8 2v12M8 2L4 6M8 2l4 4M8 14L4 10M8 14l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>

		<!-- To Section -->
		<div class="swap-section to-section">
			<div class="section-top">
				<span class="section-label">YOU RECEIVE</span>
			</div>
			<div class="swap-input-row">
				<div class="amount-display">
					<span class="to-amount-text">{toAmountDisplay}</span>
				</div>
				<button type="button" class="token-selector" onclick={() => openDialog('to')}>
					{#if $SendTxDetails.toCoin}
						<img
							src={$SendTxDetails.toCoin.coin.icon}
							alt={$SendTxDetails.toCoin.coin.label}
							class="token-icon"
						/>
						<div class="token-info">
							<span class="token-symbol">{$SendTxDetails.toCoin.coin.label}</span>
							<span class="token-name">{$SendTxDetails.toCoin.coin.label === 'BTC' ? 'Bitcoin' : $SendTxDetails.toCoin.coin.label}</span>
						</div>
					{:else}
						<span class="placeholder">Select</span>
					{/if}
					<ChevronDown size={14} />
				</button>
			</div>
		</div>

		<!-- Review Button -->
		<button type="button" class="review-btn" onclick={onExchange}>
			REVIEW SWAP
		</button>

		<!-- Route Info -->
		{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin}
			<div class="route-info">
				<span class="route-path">
					{$SendTxDetails.fromCoin.coin.label} &rarr; Magi &rarr; {$SendTxDetails.toCoin.coin.label}
				</span>
				<span class="route-tags">
					<span class="tag native">Native</span>
					<span class="tag-separator">&middot;</span>
					<span class="tag nowrap">No wrap</span>
				</span>
			</div>
		{/if}
	</div>
</div>

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
				isTo
			/>
		{/if}
	{/snippet}
</Dialog>

<style lang="scss">
	.swap-card {
		background-color: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 0.75rem;
		overflow: hidden;
	}
	.swap-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--dash-divider);
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--dash-accent-green);
	}
	.swap-title {
		color: var(--dash-text-primary);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}
	.swap-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.swap-section {
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.section-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}
	.section-label {
		color: var(--dash-text-muted);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.network-badge {
		background-color: var(--dash-card-border);
		color: var(--dash-text-secondary);
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
		font-weight: 500;
	}
	.balance-info {
		color: var(--dash-text-muted);
		font-size: 0.75rem;
		margin-left: auto;
	}
	.swap-input-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.amount-input-wrap {
		flex: 1;
		min-width: 0;
	}
	.amount-display {
		flex: 1;
		min-width: 0;
	}
	.to-amount-text {
		color: var(--dash-text-primary);
		font-size: 1.5rem;
		font-weight: 500;
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.token-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 2rem;
		color: var(--dash-text-primary);
		font-size: 0.9rem;
		cursor: pointer;
		min-width: fit-content;
		transition: background-color 0.15s;
	}
	.token-selector:hover {
		background: var(--dash-card-border);
	}
	.token-icon {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
	}
	.token-info {
		display: flex;
		flex-direction: column;
		text-align: left;
	}
	.token-symbol {
		font-weight: 600;
		font-size: 0.9rem;
		line-height: 1.2;
	}
	.token-name {
		color: var(--dash-text-muted);
		font-size: 0.7rem;
		line-height: 1.2;
	}
	.placeholder {
		color: var(--dash-text-muted);
	}
	.swap-arrow-wrap {
		display: flex;
		justify-content: center;
		padding: 0.375rem 0;
		position: relative;
		z-index: 1;
	}
	.swap-arrow-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--dash-card-border);
		background-color: var(--dash-card-bg);
		color: var(--dash-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.swap-arrow-btn:hover {
		background-color: var(--dash-card-border);
	}
	.review-btn {
		width: 100%;
		padding: 0.875rem;
		background-color: var(--dash-btn-primary);
		color: var(--dash-text-primary);
		border: none;
		border-radius: 0.75rem;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		cursor: pointer;
		margin-top: 1rem;
		transition: background-color 0.15s;
	}
	.review-btn:hover {
		background-color: var(--dash-btn-primary-hover);
	}
	.route-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.route-path {
		color: var(--dash-text-muted);
	}
	.route-tags {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.tag {
		color: var(--dash-accent-green);
		font-weight: 500;
	}
	.tag.native::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--dash-accent-green);
		margin-right: 0.25rem;
	}
	.tag-separator {
		color: var(--dash-text-muted);
	}
	.tag.nowrap {
		color: var(--dash-text-muted);
	}
</style>
