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
		<h3 class="swap-heading">Swap</h3>
		<p class="swap-sub">Native assets. Any wallet. One protocol.</p>
	</div>

	<!-- From Field -->
	<div class="swap-field">
		<div class="field-top">
			<div class="field-top-left">
				<span class="field-label">From</span>
				<span class="network-pill">Magi Network</span>
			</div>
			<span class="field-balance">Balance: 1,250 HIVE</span>
		</div>
		<div class="field-bottom">
			<div class="input-wrap">
				<AmountInput
					bind:coinAmount={inputAmount}
					coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
					{minAmount}
					styleType="normal"
				/>
			</div>
			<button type="button" class="token-select" onclick={() => openDialog('from')}>
				{#if $SendTxDetails.fromCoin}
					<img src={$SendTxDetails.fromCoin.coin.icon} alt="" class="token-img" />
					<div class="token-info">
						<span class="token-name">{$SendTxDetails.fromCoin.coin.label}</span>
						<span class="token-sub">{$SendTxDetails.fromCoin.coin.name || 'Hive'}</span>
					</div>
				{:else}
					<span class="token-name">Select</span>
				{/if}
				<ChevronDown size={14} />
			</button>
		</div>
	</div>

	<!-- Swap arrow -->
	<div class="swap-arrow-wrap">
		<button type="button" class="swap-arrow-btn">
			<span>↕</span>
		</button>
	</div>

	<!-- To Field -->
	<div class="swap-field">
		<div class="field-top">
			<span class="field-label">YOU RECEIVE</span>
		</div>
		<div class="field-bottom">
			<span class="output-amount">{toAmountDisplay}</span>
			<button type="button" class="token-select" onclick={() => openDialog('to')}>
				{#if $SendTxDetails.toCoin}
					<img src={$SendTxDetails.toCoin.coin.icon} alt="" class="token-img" />
					<div class="token-info">
						<span class="token-name">{$SendTxDetails.toCoin.coin.label}</span>
						<span class="token-sub">{$SendTxDetails.toCoin.coin.name || 'Bitcoin'}</span>
					</div>
				{:else}
					<span class="token-name">Select</span>
				{/if}
				<ChevronDown size={14} />
			</button>
		</div>
	</div>

	<!-- Rate -->
	{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin && fromInTo}
		<div class="rate-row">
			1 {$SendTxDetails.fromCoin.coin.label} ≈ {fromInTo} {$SendTxDetails.toCoin.coin.label}
		</div>
	{/if}

	<!-- Exchange -->
	<button type="button" class="exchange-btn" onclick={onExchange}>
		Exchange
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
		background-color: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		padding: 1.75rem 1.5rem;
		box-shadow: var(--dash-card-shadow);
	}

	/* Header */
	.swap-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 1.5rem;
	}
	.swap-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.75rem;
		border: 1px solid rgba(111, 106, 248, 0.3);
		border-radius: 2rem;
		margin-bottom: 0.75rem;
	}
	.swap-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #F5B300;
		box-shadow: 0 0 6px 1px rgba(245, 179, 0, 0.5);
	}
	.swap-badge-text {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--dash-text-secondary);
	}
	.swap-heading {
		font-size: 1.75rem;
		font-weight: 700;
		color: white;
		margin: 0 0 0.25rem;
	}
	.swap-sub {
		font-size: 0.8rem;
		color: var(--dash-text-muted);
		margin: 0;
	}

	/* Fields */
	.swap-field {
		background: var(--dash-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 18px;
		padding: 1rem 1.125rem;
	}
	.field-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.field-top-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.field-label {
		color: var(--dash-text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.network-pill {
		font-size: 0.65rem;
		color: var(--dash-text-muted);
		border: 1px solid var(--dash-card-border);
		border-radius: 0.25rem;
		padding: 0.15rem 0.4rem;
	}
	.field-balance {
		color: var(--dash-text-muted);
		font-size: 0.72rem;
	}
	.field-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.input-wrap {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
	.input-wrap :global(*) {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		outline: none !important;
	}
	.input-wrap :global(input) {
		width: 100%;
		max-width: 100%;
		color: white;
		font-size: 1.5rem;
		font-weight: 500;
		font-family: 'Nunito Sans', sans-serif;
		padding: 0;
		height: auto;
	}
	.output-amount {
		color: var(--dash-text-muted);
		font-size: 1.5rem;
		font-weight: 500;
		font-family: 'Nunito Sans', sans-serif;
	}

	/* Token selector */
	.token-select {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--dash-surface-alt);
		border: 1px solid var(--dash-card-border);
		border-radius: 2rem;
		color: white;
		cursor: pointer;
		white-space: nowrap;
		transition: border-color 0.15s;
		font-family: inherit;
		&:hover {
			border-color: #6F6AF8;
		}
	}
	.token-img {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
	}
	.token-info {
		display: flex;
		flex-direction: column;
		text-align: left;
	}
	.token-name {
		font-weight: 700;
		font-size: 0.85rem;
		line-height: 1.2;
	}
	.token-sub {
		font-size: 0.65rem;
		color: var(--dash-text-muted);
		line-height: 1.2;
	}

	/* Swap arrow */
	.swap-arrow-wrap {
		display: flex;
		justify-content: center;
		padding: 0.25rem 0;
		position: relative;
		z-index: 1;
	}
	.swap-arrow-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		color: var(--dash-text-secondary);
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s, color 0.15s;
		&:hover {
			border-color: #6F6AF8;
			color: #6F6AF8;
		}
	}

	/* Rate */
	.rate-row {
		color: var(--dash-text-muted);
		font-size: 0.72rem;
		text-align: center;
		padding: 0.625rem 0 0.25rem;
	}

	/* Exchange */
	.exchange-btn {
		width: 100%;
		height: 48px;
		border: none;
		border-radius: 14px;
		background: #6F6AF8;
		color: white;
		font-weight: 700;
		font-size: 0.95rem;
		font-family: inherit;
		cursor: pointer;
		margin-top: 0.5rem;
		transition: background-color 0.15s, box-shadow 0.2s;
		box-shadow: 0 4px 16px rgba(111, 106, 248, 0.25);
		&:hover {
			background: #7E74FF;
			box-shadow: 0 4px 24px rgba(111, 106, 248, 0.45);
		}
		&:active {
			transform: scale(0.98);
		}
	}
</style>
