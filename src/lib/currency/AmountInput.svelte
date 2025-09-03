<script lang="ts">
	import { untrack } from 'svelte';
	import { Coin, Network, type CoinOptions } from '../send/sendOptions';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import { type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import PillButton from '$lib/PillButton.svelte';
	import { DollarSign } from '@lucide/svelte';
	import NumberInput from '$lib/zag/NumberInput.svelte';
	import BigInput from './BigInput.svelte';

	let {
		amount = $bindable(),
		connectedCoinAmount,
		coin,
		network,
		maxField,
		styleType = 'normal',
		minAmount
	}: {
		amount: string;
		connectedCoinAmount?: CoinAmount<Coin>;
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		maxField?: BalanceOption;
		styleType?: 'normal' | 'big';
		minAmount?: CoinAmount<Coin>;
	} = $props();

	let inUsd = $state('');
	let error = $state('');
	let currentCoin = $state.raw(coins.usd);
	// let boundAmount: string = $state('');
	let lastConnected: CoinAmount<Coin> | undefined = $state();
	const quiet = $derived(connectedCoinAmount && currentCoin.value === Coin.usd.value);

	let maxBalance = $derived.by(() => {
		if (maxField && coin) {
			return new CoinAmount($accountBalance.bal[maxField], coin.coin, true).toAmountString();
		}
		return undefined;
	});

	function setToMax() {
		amount = maxBalance ?? '0';
	}

	let decimals = $derived(coin?.coin.decimalPlaces ?? 2);
	let min = $state<number>();

	let showMax = $derived(
		maxField !== undefined &&
			network?.value === Network.vsc.value &&
			new CoinAmount($accountBalance.bal[maxField], currentCoin, true).toAmountString() !==
				new CoinAmount(amount ?? 0, currentCoin).toAmountString()
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
					amount = amtString;
				});
			});
		}
	});
	$effect(() => {
		const newCoinOpt = coin;
		if (!newCoinOpt) {
			if (currentCoin !== coins.usd) {
				currentCoin = coins.usd;
			}
			return;
		}
		if (newCoinOpt.coin.value === currentCoin.value) {
			return;
		}
		untrack(() => {
			const originalAmount = new CoinAmount(amount, currentCoin);
			if (originalAmount.toNumber() === 0) {
				return;
			}
			originalAmount
				.convertTo(newCoinOpt.coin, Network.lightning)
				.then((amt) => {
					amount = amt.toAmountString(true);
				})
				.catch((err) => {
					console.log('error converting', err.message);
				});
			if (minAmount) {
				minAmount.convertTo(newCoinOpt.coin, Network.lightning).then((amt) => {
					min = amt.toNumber();
				});
			}
		});
		currentCoin = newCoinOpt.coin;
	});
	$effect(() => {
		if (minAmount) {
			minAmount.convertTo(currentCoin, Network.lightning).then((amt) => {
				min = amt.toNumber();
			});
		}
	});
	$effect(() => {
		if (!amount) {
			inUsd = '';
			return;
		}
		new CoinAmount(amount, currentCoin).convertTo(Coin.usd, Network.lightning).then((amount) => {
			inUsd = amount.toAmountString();
		});
	});

	let id = $state('');

	let debouncedMax = $state('');
	$effect(() => {
		let maxString = maxBalance ?? '';
		if (debouncedMax !== maxString) {
			debouncedMax = maxString;
		}
	});
</script>

{#if styleType === 'normal'}
	<div class="normal-wrapper">
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
			{#key [currentCoin, debouncedMax, min]}
				{@const _ = console.log('regenerating')}
				{#if quiet}
					<NumberInput
						bind:amount
						bind:inputId={id}
						max={maxBalance ? Number(maxBalance) : undefined}
						{decimals}
						{min}
					/>
				{:else}
					<NumberInput
						bind:amount
						bind:error
						bind:inputId={id}
						max={maxBalance ? Number(maxBalance) : undefined}
						{decimals}
						{min}
					/>
				{/if}
			{/key}
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
		<span class={['bottom-info', { hidden: !(showUsd || error) }]}>
			{#if error != ''}
				<span class="error">
					{error}
				</span>
			{:else if showUsd && coin && amount !== '0'}
				<span class="approx-usd">
					Approx. USD value:
					{#if coin?.coin.value != Coin.unk.value}
						${inUsd}
					{:else}
						Unknown
					{/if}
				</span>
			{/if}
		</span>
	</div>
{:else}
	<div class="big-wrapper">
		<div class="amount-input">
			<label for={id}>
				{coin?.coin.label}
			</label>
			{#key [currentCoin, debouncedMax, min]}
				<BigInput bind:amount bind:inputId={id} {decimals} {min} />
			{/key}
		</div>
	</div>
{/if}

<style lang="scss">
	.normal-wrapper,
	.big-wrapper {
		:global(input) {
			border: none;
			&:focus-visible {
				box-shadow: none;
			}
		}
	}

	.normal-wrapper {
		position: relative;
		flex: 1;
		label {
			position: absolute;
			top: -1.25rem;
			right: 0.25rem;
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
			&:has(:global(input):focus-visible) {
				box-shadow: 0 -1px inset var(--primary-bg-mid);
				border-bottom-color: var(--primary-bg-mid);
				outline: none;
				border-radius: 0.5rem 0.5rem 0 0;
				hr {
					border-color: var(--primary-bg-mid);
					border-width: 1.5px;
				}
			}

			hr {
				height: 1.5rem;
				border-right: 1px solid var(--neutral-bg-accent-shifted);
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
		.bottom-info {
			display: flex;
			flex-wrap: wrap;
			text-wrap: wrap;
			margin-bottom: 0;
			line-height: 1.2;
			&.hidden {
				visibility: hidden;
			}
		}
		.approx-usd {
			color: var(--neutral-fg-mid);
			font-size: var(--text-sm);
		}
		@media screen and (min-width: 450px) and (max-width: 650px) {
			.amount-input > .max-button-wrapper > :global(button) {
				background-color: transparent;
				padding: 0;
			}
			label {
				visibility: hidden;
			}
		}
	}
	.big-wrapper {
		--text-size: 3rem;
		display: flex;
		justify-content: center;
		.amount-input {
			display: flex;
			align-items: flex-end;
			gap: 0.5rem;
			width: min-content;
			position: relative;
			label {
				margin: 0;
				position: absolute;
				right: calc(100% + 0.5rem);
				transform: translateY(-30%);
				color: inherit;
			}
			:global(:input) {
				padding: 0;
				width: 100%;
				height: var(--text-size);
				border: none;
				&:focus-visible {
					box-shadow: none;
				}
			}
		}
	}
</style>
