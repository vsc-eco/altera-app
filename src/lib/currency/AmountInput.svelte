<script lang="ts">
	import { untrack } from 'svelte';
	import { Coin, Network, type CoinOnNetwork } from '../sendswap/utils/sendOptions';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import { DollarSign } from '@lucide/svelte';
	import NumberInput from '$lib/zag/NumberInput.svelte';
	import BigInput from './BigInput.svelte';
	import Select from '$lib/zag/Select.svelte';

	let {
		coinAmount = $bindable(),
		connectedCoinAmount,
		coinOpts,
		expressIn,
		maxAmount,
		minAmount,
		styleType = 'normal',
		id = $bindable('')
	}: {
		coinAmount: CoinAmount<Coin>;
		connectedCoinAmount?: CoinAmount<Coin>;
		coinOpts: CoinOnNetwork[];
		expressIn?: Coin;
		maxAmount?: CoinAmount<Coin>;
		minAmount?: CoinAmount<Coin>;
		styleType?: 'normal' | 'big';
		id?: string;
	} = $props();

	let inputAmt: string = $state(coinAmount?.amount !== 0 ? coinAmount.toAmountString() : '');

	let inUsd = $state('0');
	let error = $state('');
	let selected = $state.raw(coinOpts[0] ?? { coin: Coin.unk, network: Network.unknown });
	let lastModification = $state.raw(
		new CoinAmount(coinAmount.toAmountString(), coinOpts[0]?.coin ?? Coin.unk)
	);
	$effect(() => {
		if (!expressIn || lastModification.coin.value === expressIn.value) {
			if (coinAmount.amount !== lastModification.amount) coinAmount = lastModification;
		} else {
			lastModification.convertTo(expressIn, Network.lightning).then((coinAmt) => {
				if (coinAmount.amount !== coinAmt.amount) coinAmount = coinAmt;
			});
		}
	});
	// let boundAmount: string = $state('');
	let lastConnected: CoinAmount<Coin> | undefined = $state();
	const quiet = $derived(
		selected.coin.value === Coin.unk.value ||
			(connectedCoinAmount && selected.coin.value === Coin.usd.value)
	);

	function setToMax() {
		inputAmt = maxAmount?.toAmountString() ?? '0';
	}

	let decimals = $derived(coinOpts[0]?.coin.decimalPlaces ?? 2);
	let min = $state<number>();
	let max = $state<number>();
	$effect(() => {
		if (!minAmount) {
			min = undefined;
			return;
		}
		if (minAmount.coin.value === selected.coin.value) {
			min = minAmount.toNumber();
			return;
		}
		(async () => {
			let convertTo = await minAmount.convertTo(selected.coin, Network.lightning);
			let convertBack = await convertTo.convertTo(minAmount.coin, Network.lightning);
			while (convertBack.toNumber() < minAmount.toNumber()) {
				convertTo = new CoinAmount(convertTo.amount + 1, selected.coin, true);
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
		if (maxAmount.coin.value === selected.coin.value) {
			max = maxAmount.toNumber();
			return;
		}
		(async () => {
			const originalCoinValue = selected.coin.value;
			let convertTo = await maxAmount.convertTo(selected.coin, Network.lightning);
			let convertBack = await convertTo.convertTo(maxAmount.coin, Network.lightning);
			while (convertBack.toNumber() > maxAmount.toNumber()) {
				convertTo = new CoinAmount(convertTo.amount - 1, selected.coin, true);
				convertBack = await convertTo.convertTo(maxAmount.coin, Network.lightning);
			}
			// make sure it hasn't changed again while loop ran
			if (originalCoinValue === selected.coin.value) max = convertTo.toNumber();
		})();
	});

	let showMax = $derived(
		maxAmount !== undefined &&
			maxAmount.toAmountString() !==
				new CoinAmount(inputAmt ?? 0, selected.coin).toAmountString() &&
			selected.coin.value === maxAmount.coin.value
	);

	let showUsd = $derived(
		!(
			connectedCoinAmount?.coin.value === coins.usd.value || selected.coin.value === coins.usd.value
		)
	);

	$effect(() => {
		if (connectedCoinAmount) {
			untrack(() => {
				if (!lastConnected) {
					console.log('set last connected branch');
					lastConnected = connectedCoinAmount;
					return;
				}
				if (connectedCoinAmount.toString() === lastConnected?.toString()) {
					console.log('nothing branch');
					return;
				}
				Promise.all([
					connectedCoinAmount.convertTo(selected.coin, Network.lightning),
					new CoinAmount(inputAmt, selected.coin).convertTo(
						connectedCoinAmount.coin,
						Network.lightning
					)
				]).then(([connectedInThis, thisInConnected]) => {
					console.log('update branch');
					if (thisInConnected.toString() === connectedCoinAmount.toString()) {
						return;
					}
					const amtString = connectedInThis.toAmountString();
					// do this first to stop future effects
					lastConnected = connectedCoinAmount;
					inputAmt = amtString;
				});
			});
		}
	});
	function updateAmount(newCoin: Coin) {
		if (lastModification.toNumber() === 0) {
			return;
		}
		coinChangeUpdateGuard = true;
		if (lastModification.coin.value === newCoin.value) {
			inputAmt = lastModification.toAmountString();
		} else {
			lastModification
				.convertTo(newCoin, Network.lightning)
				.then((amt) => {
					inputAmt = amt.toAmountString(true);
				})
				.catch((err) => {
					console.error('error converting', err.message);
				});
		}
	}
	$effect(() => {
		const newCoinOpts = coinOpts;
		if (newCoinOpts.length === 0) {
			if (selected.coin !== coins.unk) {
				selected = { coin: Coin.unk, network: Network.unknown };
			}
			return;
		}
		const coinValues = newCoinOpts.map((coinOpt) => coinOpt.coin.value);
		if (coinValues.includes(selected.coin.value)) {
			return;
		}
		// default to first new option on change
		const newDefaultCoinOpt = newCoinOpts[0];
		untrack(() => {
			updateAmount(newDefaultCoinOpt.coin);
		});
		selected = newDefaultCoinOpt;
	});
	let coinChangeUpdateGuard = false;
	$effect(() => {
		inputAmt;
		untrack(() => {
			if (coinChangeUpdateGuard) {
				coinChangeUpdateGuard = false;
				return;
			}
			lastModification = new CoinAmount(inputAmt, selected.coin);
			if (!inputAmt) {
				inUsd = '0';
				return;
			}
			new CoinAmount(inputAmt, selected.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amount) => {
					inUsd = amount.toAmountString();
				});
		});
	});

	let debouncedMax = $state('');
	$effect(() => {
		let maxString = maxAmount?.toAmountString() ?? '';
		if (debouncedMax !== maxString) {
			debouncedMax = maxString;
		}
	});

	const selectionItems = $derived(
		coinOpts.map((coinOpt) => ({
			...coinOpt,
			value: coinOpt.coin.value,
			label: coinOpt.coin.label
		}))
	);
</script>

{#if styleType === 'normal'}
	<div class="normal-wrapper">
		<label for={id}>
			<span>
				{#if maxAmount !== undefined && selected.coin.value === maxAmount.coin.value}
					<span style="white-space: nowrap;">
						(Balance:
						<span class="balance-amount">
							{maxAmount!.toPrettyString()}
						</span>)
					</span>
				{/if}
			</span>
		</label>
		<div class="amount-input">
			{#if selected.coin.value === coins.usd.value}
				<DollarSign />
			{:else}
				<CoinNetworkIcon coin={selected.coin} network={selected.network} />
			{/if}
			{#key [selected, debouncedMax, min]}
				{#if quiet}
					<NumberInput bind:amount={inputAmt} bind:inputId={id} {max} {decimals} {min} />
				{:else}
					<NumberInput bind:amount={inputAmt} bind:error bind:inputId={id} {max} {decimals} {min} />
				{/if}
			{/key}
			{#if showMax}
				<div class="max-button-wrapper">
					<PillButton type="button" onclick={setToMax}>Max</PillButton>
				</div>
			{/if}
			<hr />
			{#if coinOpts.length > 1}
				<Select
					items={selectionItems}
					initial={selected.coin.value}
					onValueChange={(v) => {
						if (v.items[0] === undefined) return;
						if (v.items[0].value === Coin.unk.value) return;
						if (selected.coin.value !== v.items[0].value) {
							selected = v.items[0];
							updateAmount(selected.coin);
						}
					}}
				/>
			{:else}
				<div class="coin-label">
					{selected.coin.label}
				</div>
			{/if}
		</div>
		<span class={['bottom-info', { hidden: !(showUsd || error) }]}>
			{#if error != ''}
				<span class="error">
					{error}
				</span>
			{:else if showUsd && coinOpts && inputAmt !== '0'}
				<span class="approx-usd">
					Approx. USD value:
					{#if selected.coin.value != Coin.unk.value}
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
				{selected.coin.label}
			</label>
			{#key [selected, debouncedMax, min]}
				<BigInput bind:amount={inputAmt} bind:inputId={id} {decimals} {min} />
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
			position: absolute;
			display: flex;
			flex-wrap: wrap;
			text-wrap: wrap;
			margin-bottom: 0;
			padding-top: 0.25rem;
			line-height: 1.2;
			&.hidden {
				visibility: hidden;
			}
			.error {
				font-size: var(--text-sm);
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
