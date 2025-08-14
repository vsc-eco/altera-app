<script lang="ts">
	import { untrack } from 'svelte';
	import { Coin, Network, type CoinOptions } from '../send/sendOptions';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import { type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import PillButton from '$lib/PillButton.svelte';
	import { DollarSign } from '@lucide/svelte';

	let {
		amount = $bindable(),
		connectedCoinAmount,
		coin,
		network,
		id,
		maxField
	}: {
		amount: string;
		connectedCoinAmount?: CoinAmount<Coin>;
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		id: string;
		maxField?: BalanceOption;
	} = $props();

	let inUsd = $state('');
	let error = $state('');
	let currentCoin = $state.raw(coins.usd);
	let boundAmount: string | null = $state(null);
	let lastConnected: CoinAmount<Coin> | undefined = $state();

	let showMax = $derived(
		maxField !== undefined &&
			network?.value === Network.vsc.value &&
			new CoinAmount($accountBalance.bal[maxField], currentCoin, true).toAmountString() !==
				new CoinAmount(boundAmount ?? 0, currentCoin).toAmountString()
	);

	let showUsd = $derived(
		!(connectedCoinAmount?.coin.value === coins.usd.value || coin?.coin.value === coins.usd.value)
	);

	$effect(() => {
		if (connectedCoinAmount && coin) {
			untrack(() => {
				if (!lastConnected) {
					lastConnected = connectedCoinAmount;
					return;
				}
				if (connectedCoinAmount.toString() === lastConnected.toString()) {
					return;
				}
				Promise.all([
					connectedCoinAmount.convertTo(coin.coin, Network.lightning),
					new CoinAmount(amount, coin.coin).convertTo(connectedCoinAmount.coin, Network.lightning)
				]).then(([connectedInThis, thisInConnected]) => {
					if (thisInConnected.toString() === connectedCoinAmount.toString()) {
						return;
					}
					const amtString = connectedInThis.toAmountString();
					// do this first to stop future effects
					lastConnected = connectedCoinAmount;
					if (amtString === '0' && boundAmount && boundAmount !== '0') {
						boundAmount = null;
					} else {
						boundAmount = amtString;
					}
					amount = amtString;
				});
			});
		}
	});
	$effect(() => {
		const _ = showMax;
		untrack(() => {
			if (boundAmount) amount = isInRange() ? boundAmount : '0';
		});
	});
	$effect(() => {
		// makes it reactive to boundAmount, which is only in a "then" otherwise
		const newCoinOpt = coin;
		if (!newCoinOpt) {
			if (currentCoin !== coins.usd) {
				boundAmount = null;
				currentCoin = coins.usd;
			}
			return;
		}
		if (newCoinOpt.coin.value === currentCoin.value) {
			return;
		}
		untrack(() => {
			if (!boundAmount) return;
			const originalAmount = new CoinAmount(boundAmount, currentCoin);
			if (originalAmount.toNumber() === 0) {
				return;
			}
			originalAmount
				.convertTo(newCoinOpt.coin, Network.lightning)
				.then((amt) => {
					boundAmount = amt.toAmountString(true);
					amount = isInRange() ? boundAmount : '0';
				})
				.catch((err) => {
					console.log('error converting', err.message);
				});
		});
		currentCoin = newCoinOpt.coin;
	});
	$effect(() => {
		if (!boundAmount) {
			inUsd = '';
			return;
		}
		new CoinAmount(boundAmount, currentCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toAmountString();
			});
		error = '';
	});

	let maxBalance = $derived.by(() => {
		if (showMax && maxField && coin) {
			return new CoinAmount($accountBalance.bal[maxField], coin.coin, true).toAmountString();
		}
		return undefined;
	});

	function setToMax() {
		amount = maxBalance ?? '0';
		boundAmount = maxBalance ?? '0';
	}

	function isInRange() {
		if (
			!boundAmount ||
			Number(boundAmount) < 0 ||
			(maxBalance && Number(boundAmount) > Number(maxBalance))
		)
			return false;
		return true;
	}
</script>

<div class="wrapper">
	<label for={id}>
		<span>
			{#if showMax && maxField}
				<span style="white-space: nowrap;">
					(Balance:
					<span class="balance-amount">
						{new CoinAmount($accountBalance.bal[maxField], currentCoin, true).toPrettyString()}
					</span>)
				</span>
			{/if}
		</span>
	</label>
	<div class="amount-input">
		{#if !coin?.coin || coin.coin.value === coins.usd.value}
			<DollarSign />
		{:else}
			<CoinNetworkIcon coin={coin?.coin ?? coins.usd} network={network ?? Network.unknown} />
		{/if}
		<input
			min="0.00000001"
			max={maxBalance}
			oninvalid={(e) => {
				e.preventDefault();
				const target = e.currentTarget;
				if (target.validity.rangeUnderflow) {
					error = 'Amount must be greater than zero.';
				} else if (target.validity.rangeOverflow) {
					error = 'Amount exceeds available balance.';
				}
				target.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
					inline: 'center'
				});
			}}
			oninput={() => {
				if (boundAmount && isInRange()) {
					amount = new CoinAmount(boundAmount, currentCoin).toAmountString();
				} else {
					amount = '0';
				}
			}}
			required={true}
			{id}
			type="number"
			step="any"
			inputmode="decimal"
			bind:value={boundAmount}
		/>
		{#if showMax}
			<div class="max-button-wrapper">
				<PillButton type="button" onclick={setToMax}>Max</PillButton>
			</div>
		{/if}
		<hr />
		<div class="coin-label">
			{currentCoin.label}
		</div>
	</div>
	{#if showUsd}
		<span class={['approx-usd', { hidden: !(coin && boundAmount) }]}>
			Approx. USD value:
			{#if coin?.coin.value != Coin.unk.value}
				${inUsd}
			{:else}
				Unknown
			{/if}
		</span>
	{/if}
	{#if error != ''}
		<span class="error">
			{error}
		</span>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		position: relative;
		flex-grow: 1;
	}
	label {
		position: absolute;
		top: 0;
		right: 0;
		translate: -0.5rem -1.75rem;
	}
	.balance-amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
	}
	.amount-input {
		border: 1px solid var(--neutral-bg-accent-shifted);
		color: var(--neutral-fg);
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		flex-basis: 1;
		box-sizing: border-box;
		&:has(input:focus-visible) {
			box-shadow: 0 -1px inset var(--primary-bg-mid);
			border-bottom-color: var(--primary-bg-mid);
			outline: none;
			border-radius: 0.5rem 0.5rem 0 0;
		}

		hr {
			height: 1.5rem;
			border-right: 1px solid var(--neutral-bg-accent-shifted);
		}

		input:focus-visible + hr {
			border-color: var(--primary-bg-mid);
			border-width: 1.5px;
		}

		input {
			border: none;
			height: 48px;
			box-sizing: border-box;
			min-width: 3.5rem;
			width: 1rem;
			flex-grow: 1;
		}
		input:focus-visible {
			box-shadow: none;
		}
		.max-button-wrapper {
			margin-right: 0.25rem;
			:global(button) {
				font-size: var(--text-sm);
				padding: 0.5rem 0.75rem;
				height: fit-content;
			}
		}
	}
	.coin-label {
		width: 4rem;
		text-align: center;
	}
	.approx-usd {
		text-wrap: wrap;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		margin-bottom: 0;
		line-height: 1.2;
		&.hidden {
			visibility: hidden;
		}
	}
</style>
