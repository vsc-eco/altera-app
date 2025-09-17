<script lang="ts">
	import { untrack } from 'svelte';
	import { Coin, Network, type CoinOptions } from '../sendswap/utils/sendOptions';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import { type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import PillButton from '$lib/PillButton.svelte';
	import { ChevronRight, DollarSign } from '@lucide/svelte';
	import NumberInput from '$lib/zag/NumberInput.svelte';
	import BigInput from './BigInput.svelte';

	let {
		amount = $bindable(),
		connectedCoinAmount,
		coin,
		network,
		maxField,
		maxAmount,
		minAmount,
		styleType = 'normal',
		buttonAction
	}: {
		amount: string;
		connectedCoinAmount?: CoinAmount<Coin>;
		coin: CoinOptions['coins'][number] | undefined;
		network: Network | undefined;
		maxField?: BalanceOption;
		maxAmount?: CoinAmount<Coin>;
		minAmount?: CoinAmount<Coin>;
		styleType?: 'normal' | 'big';
		buttonAction?: (() => void) | undefined;
	} = $props();

	let inUsd = $state('');
	let error = $state('');
	let currentCoin = $state.raw(Coin.unk);
	let lastModification = $state.raw(new CoinAmount(amount, Coin.unk));
	// let boundAmount: string = $state('');
	let lastConnected: CoinAmount<Coin> | undefined = $state();
	const quiet = $derived(
		currentCoin.value === Coin.unk.value ||
			(connectedCoinAmount && currentCoin.value === Coin.usd.value)
	);

	$effect(() => {
		if (!maxAmount && maxField) {
			const maxCoin = Object.values(Coin).find((coin) => coin.value === maxField);
			if (maxCoin) maxAmount = new CoinAmount($accountBalance.bal[maxField], maxCoin, true);
		}
	});

	function setToMax() {
		amount = maxAmount?.toAmountString() ?? '0';
	}

	let decimals = $derived(coin?.coin.decimalPlaces ?? 2);
	let min = $state<number>();
	let max = $state<number>();
	$effect(() => {
		if (!minAmount) {
			min = undefined;
			return;
		}
		if (minAmount.coin.value === currentCoin.value) {
			min = minAmount.toNumber();
			return;
		}
		(async () => {
			let convertTo = await minAmount.convertTo(currentCoin, Network.lightning);
			let convertBack = await convertTo.convertTo(minAmount.coin, Network.lightning);
			while (convertBack.toNumber() < minAmount.toNumber()) {
				convertTo = new CoinAmount(convertTo.amount + 1, currentCoin, true);
				convertBack = await convertTo.convertTo(minAmount.coin, Network.lightning);
			}
			min = convertTo.toNumber();
		})();
	});
	$effect(() => {
		if (!maxAmount) {
			max = undefined;
			return;
		}
		if (maxAmount.coin.value === currentCoin.value) {
			max = maxAmount.toNumber();
			return;
		}
		(async () => {
			let convertTo = await maxAmount.convertTo(currentCoin, Network.lightning);
			let convertBack = await convertTo.convertTo(maxAmount.coin, Network.lightning);
			while (convertBack.toNumber() > maxAmount.toNumber()) {
				convertTo = new CoinAmount(convertTo.amount - 1, currentCoin, true);
				convertBack = await convertTo.convertTo(maxAmount.coin, Network.lightning);
			}
			max = convertTo.toNumber();
		})();
	});

	let showMax = $derived(
		maxAmount !== undefined &&
			maxAmount.toAmountString() !== new CoinAmount(amount ?? 0, currentCoin).toAmountString()
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
			if (currentCoin !== coins.unk) {
				currentCoin = coins.unk;
			}
			return;
		}
		if (newCoinOpt.coin.value === currentCoin.value) {
			return;
		}
		untrack(() => {
			if (lastModification.toNumber() === 0) {
				return;
			}
			coinChangeUpdateGuard = true;
			if (lastModification.coin.value === newCoinOpt.coin.value) {
				amount = lastModification.toAmountString();
			} else {
				lastModification
					.convertTo(newCoinOpt.coin, Network.lightning)
					.then((amt) => {
						amount = amt.toAmountString(true);
					})
					.catch((err) => {
						console.log('error converting', err.message);
					});
			}
		});
		currentCoin = newCoinOpt.coin;
	});
	let coinChangeUpdateGuard = false;
	$effect(() => {
		amount;
		untrack(() => {
			if (coinChangeUpdateGuard) {
				coinChangeUpdateGuard = false;
				return;
			}
			lastModification = new CoinAmount(amount, currentCoin);
			if (!amount) {
				inUsd = '';
				return;
			}
			new CoinAmount(amount, currentCoin).convertTo(Coin.usd, Network.lightning).then((amount) => {
				inUsd = amount.toAmountString();
			});
		});
	});

	let id = $state('');

	let debouncedMax = $state('');
	$effect(() => {
		let maxString = maxAmount?.toAmountString() ?? '';
		if (debouncedMax !== maxString) {
			debouncedMax = maxString;
		}
	});
</script>

{#if styleType === 'normal'}
	<div class="normal-wrapper">
		<label for={id}>
			<span>
				{#if showMax && maxAmount}
					<span style="white-space: nowrap;">
						(Balance:
						<span class="balance-amount">
							{maxAmount.toPrettyString()}
						</span>)
					</span>
				{/if}
			</span>
		</label>
		<div class={['amount-input', { tall: !!buttonAction }]}>
			{#snippet icon()}
				{#if coin?.coin.value === coins.usd.value}
					<DollarSign />
				{:else}
					<CoinNetworkIcon
						coin={currentCoin}
						network={coin ? (network ?? Network.unknown) : Network.unknown}
					/>
				{/if}
			{/snippet}
			{#if !buttonAction}
				{@render icon()}
			{/if}
			{#key [currentCoin, debouncedMax, min]}
				{#if quiet}
					<NumberInput bind:amount bind:inputId={id} {max} {decimals} {min} />
				{:else}
					<NumberInput bind:amount bind:error bind:inputId={id} {max} {decimals} {min} />
				{/if}
			{/key}
			{#if showMax}
				<div class="max-button-wrapper">
					<PillButton type="button" onclick={setToMax}>Max</PillButton>
				</div>
			{/if}
			<hr />
			{#if buttonAction}
				<div class="coin-button">
					<PillButton onclick={buttonAction}>
						<div class="coin-button-content">
							{#if coin}
								<div class="icon">
									{@render icon()}
								</div>
								<span class="label">
									{currentCoin.label}
								</span>
								<ChevronRight />
							{:else}
								Select
							{/if}
						</div>
					</PillButton>
				</div>
			{:else}
				<div class="coin-label">
					{currentCoin.label}
				</div>
			{/if}
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
		.coin-button {
			padding: 0.25rem 0.5rem;
		}
		.coin-button-content {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 108px;
			justify-content: center;
			.icon {
				width: 32px;
				display: flex;
				justify-content: center;
			}
			.label {
				width: 4ch;
				text-align: center;
			}
		}
		.bottom-info {
			display: flex;
			flex-wrap: wrap;
			text-wrap: wrap;
			margin-bottom: 0;
			padding-top: 0.25rem;
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
				left: calc(100% + 0.5rem);
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
