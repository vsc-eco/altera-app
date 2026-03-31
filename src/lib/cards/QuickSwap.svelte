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

	// USD values
	let fromUsd = $state('');
	let toUsd = $state('');
	$effect(() => {
		const amt = parseFloat($SendTxDetails.fromAmount || '0');
		if (!$SendTxDetails.fromCoin || amt === 0) { fromUsd = ''; return; }
		new CoinAmount(amt, $SendTxDetails.fromCoin.coin)
			.convertTo(Coin.usd, Network.lightning)
			.then((usd) => { fromUsd = `≈ $${usd.toPrettyAmountString()}`; })
			.catch(() => { fromUsd = ''; });
	});
	$effect(() => {
		const amt = parseFloat($SendTxDetails.toAmount || '0');
		if (!$SendTxDetails.toCoin || amt === 0) { toUsd = ''; return; }
		new CoinAmount(amt, $SendTxDetails.toCoin.coin)
			.convertTo(Coin.usd, Network.lightning)
			.then((usd) => { toUsd = `≈ $${usd.toPrettyAmountString()}`; })
			.catch(() => { toUsd = ''; });
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
		return parts.join(' \u2022 ');
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
	<!-- Header -->
	<div class="swap-header">
		<div class="swap-badge">
			<span class="swap-dot"></span>
			<span class="swap-badge-text">MAGI CROSS-CHAIN</span>
		</div>
	</div>

	<!-- From Field -->
	<div class="swap-field">
		<div class="field-top">
			<span class="field-label">From</span>
			<span class="field-meta">{fromSubtitle}</span>
		</div>
		<div class="field-bottom">
			<input
				type="number"
				class="amount-input"
				placeholder="0.00"
				value={$SendTxDetails.fromAmount || ''}
				oninput={(e) => {
					$SendTxDetails.fromAmount = e.currentTarget.value;
					if ($SendTxDetails.fromCoin) {
						inputAmount = new CoinAmount(parseFloat(e.currentTarget.value) || 0, $SendTxDetails.fromCoin.coin);
					}
				}}
			/>
			<button type="button" class="token-select" onclick={() => openDialog('from')}>
				{#if $SendTxDetails.fromCoin}
					<img src={$SendTxDetails.fromCoin.coin.icon} alt="" class="token-img" />
					<span class="token-name">{$SendTxDetails.fromCoin.coin.label}</span>
				{:else}
					<span class="token-name muted">Select</span>
				{/if}
				<ChevronDown size={12} />
			</button>
		</div>
		{#if fromUsd}
			<span class="usd-value">{fromUsd}</span>
		{/if}
	</div>

	<!-- Swap arrow -->
	<div class="swap-arrow-wrap">
		<button type="button" class="swap-arrow-btn">↕</button>
	</div>

	<!-- To Field -->
	<div class="swap-field">
		<div class="field-top">
			<span class="field-label">You receive</span>
			<span class="field-meta">{toSubtitle}</span>
		</div>
		<div class="field-bottom">
			<span class="output-amount">{toAmountDisplay}</span>
			<button type="button" class="token-select" onclick={() => openDialog('to')}>
				{#if $SendTxDetails.toCoin}
					<img src={$SendTxDetails.toCoin.coin.icon} alt="" class="token-img" />
					<span class="token-name">{$SendTxDetails.toCoin.coin.label}</span>
				{:else}
					<span class="token-name muted">Select</span>
				{/if}
				<ChevronDown size={12} />
			</button>
		</div>
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
				<span class="detail-value">0.08% + CLP</span>
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
			<div class="detail-row">
				<span class="detail-label">Slippage</span>
				<div class="slippage-pills">
					{#each [0.5, 1, 2, 3] as pct}
						<button class="slip-pill" class:active={pct === 1}>{pct}%</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Exchange -->
	<button type="button" class="exchange-btn" onclick={onExchange}>
		Swap
	</button>
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
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		padding: 1.25rem;
		box-shadow: var(--dash-card-shadow);
	}

	/* Header */
	.swap-header {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}
	.swap-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.65rem;
		border: 1px solid rgba(111, 106, 248, 0.25);
		border-radius: 2rem;
	}
	.swap-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #6F6AF8;
		box-shadow: 0 0 6px 1px rgba(111, 106, 248, 0.5);
	}
	.swap-badge-text {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--dash-text-secondary);
	}

	/* Fields */
	.swap-field {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		padding: 0.875rem 1rem;
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
	.field-meta {
		color: var(--dash-text-muted);
		font-size: 0.65rem;
	}
	.field-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.amount-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: white;
		font-size: 1.25rem;
		font-weight: 600;
		font-family: 'Nunito Sans', sans-serif;
		padding: 0;
		height: auto;
		&::placeholder {
			color: var(--dash-text-muted);
		}
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
	.slippage-pills {
		display: flex;
		gap: 0.25rem;
	}
	.slip-pill {
		padding: 0.15rem 0.4rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: var(--dash-text-muted);
		font-size: 0.6rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		&.active {
			background: rgba(111, 106, 248, 0.2);
			border-color: rgba(111, 106, 248, 0.4);
			color: #6F6AF8;
		}
		&:hover:not(.active) {
			border-color: rgba(255, 255, 255, 0.15);
			color: var(--dash-text-secondary);
		}
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
</style>
