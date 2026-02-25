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
	import Card from '$lib/cards/Card.svelte';
	import PillButton from '$lib/PillButton.svelte';
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

<Card>
	<div class="quick-swap">
		<h3 class="title">Quick swap</h3>

		<div class="field from-field">
			<div class="field-header">
				<span class="label">From</span>
				<span class="subtitle">{fromSubtitle}</span>
			</div>
			<div class="input-row">
				<div class="amount-wrap">
					<AmountInput
						bind:coinAmount={inputAmount}
						coinOpts={fromOnlyCoinOpts.length > 0 ? fromOnlyCoinOpts : possibleCoins}
						{minAmount}
						styleType="normal"
					/>
				</div>
				<button type="button" class="selector" onclick={() => openDialog('from')}>
					{#if $SendTxDetails.fromCoin}
						<img
							src={$SendTxDetails.fromCoin.coin.icon}
							alt={$SendTxDetails.fromCoin.coin.label}
							class="coin-icon"
						/>
						<span class="coin-label">{$SendTxDetails.fromCoin.coin.label}</span>
					{:else}
						<span class="placeholder">Select</span>
					{/if}
					<ChevronDown class="chevron" size={16} />
				</button>
			</div>
		</div>

		<div class="field">
			<div class="field-header">
				<span class="label">To</span>
				<span class="subtitle">{toSubtitle}</span>
			</div>
			<div class="input-row">
				<div class="amount-wrap to-amount">
					<span class="to-amount-text">{toAmountDisplay}</span>
				</div>
				<button type="button" class="selector" onclick={() => openDialog('to')}>
					{#if $SendTxDetails.toCoin}
						<img
							src={$SendTxDetails.toCoin.coin.icon}
							alt={$SendTxDetails.toCoin.coin.label}
							class="coin-icon"
						/>
						<span class="coin-label">{$SendTxDetails.toCoin.coin.label}</span>
					{:else}
						<span class="placeholder">Select</span>
					{/if}
					<ChevronDown class="chevron" size={16} />
				</button>
			</div>
		</div>

		{#if $SendTxDetails.fromCoin && $SendTxDetails.toCoin && fromInTo}
			<p class="rate">1 {$SendTxDetails.fromCoin.coin.label} ≈ {fromInTo} {$SendTxDetails.toCoin.coin.label}</p>
		{/if}

		<PillButton
			theme="primary"
			class="exchange-btn"
			onclick={onExchange}
		>
			Exchange
		</PillButton>
	</div>
</Card>

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
	.quick-swap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.25rem;
	}
	.title {
		color: var(--primary-text);
		font-size: var(--text-lg);
		font-weight: 600;
		margin: 0 0 0.25rem 0;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field.from-field {
		padding-bottom: 1.25rem;
	}
	.field-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		color: var(--secondary-text);
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.subtitle {
		color: var(--secondary-text);
		font-size: 0.75rem;
		margin: 0;
	}
	.input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.amount-wrap {
		flex: 1;
		min-width: 0;
		background: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
	}
	.amount-wrap.to-amount {
		display: flex;
		align-items: center;
	}
	.to-amount-text {
		color: var(--primary-text);
		font-size: var(--text-base);
	}
	.selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--neutral-off-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.5rem;
		color: var(--primary-text);
		font-size: var(--text-sm);
		cursor: pointer;
		min-width: fit-content;
	}
	.selector:hover {
		background: var(--neutral-bg-accent);
	}
	.coin-icon {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
	}
	.placeholder {
		color: var(--secondary-text);
	}
	.rate {
		color: var(--secondary-text);
		font-size: 0.75rem;
		margin: 0;
	}
	.quick-swap :global(.exchange-btn) {
		margin-top: 0.5rem;
		width: 100%;
		--height: 3rem;
		height: var(--height);
		background-color: var(--primary-fg-mid) !important;
		color: var(--primary-text) !important;
		border: none !important;
		font-weight: 600;
	}
	.quick-swap :global(.exchange-btn:hover) {
		background-color: var(--primary-fg-mid) !important;
		opacity: 0.95;
		filter: brightness(1.08);
	}
	.quick-swap :global(.exchange-btn:active) {
		background-color: var(--primary-fg-mid) !important;
		opacity: 0.9;
	}
</style>
