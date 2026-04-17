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
	import { getHiveAssetName, getHbdAssetName } from '../../client';

	let {
		coinAmount = $bindable(),
		connectedCoinAmount,
		coinOpts,
		expressIn,
		maxAmount,
		minAmount,
		onAmountChange,
		styleType = 'normal',
		hideUnit = false,
		borderless = false,
		hideNetwork = false,
		id = $bindable(''),
		disabled = false
	}: {
		coinAmount: CoinAmount<Coin>;
		connectedCoinAmount?: CoinAmount<Coin>;
		coinOpts: CoinOnNetwork[];
		expressIn?: Coin;
		maxAmount?: CoinAmount<Coin>;
		minAmount?: CoinAmount<Coin>;
		onAmountChange?: (amount: CoinAmount<Coin>) => void;
		styleType?: 'normal' | 'big' | 'simple';
		hideUnit?: boolean;
		borderless?: boolean;
		hideNetwork?: boolean;
		id?: string;
		disabled?: boolean;
	} = $props();

	let inputAmt: string = $state(coinAmount?.amount !== 0 ? coinAmount.toAmountString() : '');

	let inUsd = $state('0');
	let error = $state('');
	const initialFirstOption = untrack(() => coinOpts[0]);
	let selected = $state.raw(initialFirstOption ?? { coin: Coin.unk, network: Network.unknown });
	let lastModification = $state.raw(
		new CoinAmount(coinAmount.toAmountString(), initialFirstOption?.coin ?? Coin.unk)
	);

	let externalSync = false;
	$effect(() => {
		// Always read dependencies to maintain tracking even when guard fires
		const currentMod = lastModification;
		const currentExpressIn = expressIn;
		const currentCoinAmtStr = coinAmount.toAmountString();

		if (externalSync) {
			externalSync = false;
			return;
		}
		if (!currentExpressIn || currentMod.coin.value === currentExpressIn.value) {
			if (currentCoinAmtStr !== currentMod.toAmountString()) coinAmount = currentMod;
		} else {
			const capturedMod = currentMod;
			capturedMod.convertTo(currentExpressIn, Network.lightning).then((coinAmt) => {
				if (untrack(() => lastModification) !== capturedMod) return;
				if (untrack(() => coinAmount.toAmountString()) !== coinAmt.toAmountString())
					coinAmount = coinAmt;
			});
		}
	});
	// Sync external coinAmount changes back to internal inputAmt
	$effect.pre(() => {
		// Read coinAmount to track reassignment from parent
		const ext = coinAmount;
		const extAmt = ext.amount;
		const modAmt = untrack(() => lastModification.amount);
		if (extAmt !== modAmt) {
			externalSync = true;
			inputAmt = ext.toAmountString();
			lastModification = ext;
		}
	});
	let lastConnected: CoinAmount<Coin> | undefined = $state();
	const quiet = $derived(
		selected.coin.value === Coin.unk.value ||
			(connectedCoinAmount && selected.coin.value === Coin.usd.value)
	);

	function setToMax() {
		inputAmt = maxAmount?.toAmountString() ?? '0';
	}

	let decimals = $derived(selected.coin.decimalPlaces);
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
		!disabled &&
			maxAmount !== undefined &&
			maxAmount.toAmountString() !==
				new CoinAmount(inputAmt ?? 0, selected.coin).toAmountString() &&
			selected.coin.value === maxAmount.coin.value
	);

	let showUsd = $derived(
		!(connectedCoinAmount?.coin.value === Coin.usd.value || selected.coin.value === Coin.usd.value)
	);

	$effect(() => {
		if (connectedCoinAmount) {
			untrack(() => {
				if (!lastConnected) {
					lastConnected = connectedCoinAmount;
					return;
				}
				if (connectedCoinAmount.toString() === lastConnected?.toString()) {
					return;
				}
				Promise.all([
					connectedCoinAmount.convertTo(selected.coin, Network.lightning),
					new CoinAmount(inputAmt, selected.coin).convertTo(
						connectedCoinAmount.coin,
						Network.lightning
					)
				]).then(([connectedInThis, thisInConnected]) => {
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
			if (selected.coin !== Coin.unk) {
				selected = { coin: Coin.unk, network: Network.unknown };
			}
			return;
		}

		if (
			newCoinOpts.some(
				(coinOpt) =>
					coinOpt.coin.value === selected.coin.value &&
					coinOpt.network.value === selected.network.value
			)
		) {
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
			onAmountChange?.(lastModification);
			if (!inputAmt) {
				inUsd = '0';
				return;
			}
			new CoinAmount(inputAmt, selected.coin)
				.convertTo(Coin.usd, Network.lightning)
				.then((amount) => {
					inUsd = amount.toAmountString(true);
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

	const displayLabel = $derived(
		selected.coin.value === Coin.hive.value
			? getHiveAssetName()
			: selected.coin.value === Coin.hbd.value
				? getHbdAssetName()
				: selected.coin.label
	);
	const displayUnit = $derived(
		selected.coin.value === Coin.hive.value
			? getHiveAssetName()
			: selected.coin.value === Coin.hbd.value
				? getHbdAssetName()
				: selected.coin.unit
	);
	// Balance string with display unit (e.g. TESTS/TBD) for hive/hbd
	const balanceDisplay = $derived(
		maxAmount && selected.coin.value === maxAmount.coin.value
			? (() => {
					const n = Math.abs(maxAmount.amount) / 10 ** maxAmount.coin.decimalPlaces;
					const formatter = new Intl.NumberFormat(undefined, {
						useGrouping: true,
						minimumFractionDigits: maxAmount.coin.decimalPlaces
					});
					return `${formatter.format(n)} ${displayUnit}`;
				})()
			: ''
	);
	const selectionItems = $derived(
		coinOpts.map((coinOpt) => ({
			...coinOpt,
			value: coinOpt.coin.value,
			label:
				coinOpt.coin.value === Coin.hive.value
					? getHiveAssetName()
					: coinOpt.coin.value === Coin.hbd.value
						? getHbdAssetName()
						: coinOpt.coin.label
		}))
	);
</script>

{#if styleType === 'normal'}
	<div class="normal-wrapper">
		<label for={id}>
			<span>
				{#if maxAmount !== undefined && selected.coin.value === maxAmount.coin.value}
					<span style="white-space: nowrap;">
						Balance:
						<span class="balance-amount">
							{balanceDisplay || maxAmount!.toPrettyString()}
						</span>
					</span>
				{/if}
			</span>
		</label>
		<div class={['amount-input', { borderless }]}>
			{#if selected.coin.value === Coin.usd.value}
				<DollarSign />
			{:else}
				<CoinNetworkIcon coin={selected.coin} network={selected.network} {hideNetwork} />
			{/if}
			{#key [selected, debouncedMax, min]}
				{#if quiet}
					<NumberInput bind:amount={inputAmt} bind:inputId={id} {max} {decimals} {min} {disabled} />
				{:else}
					<NumberInput
						bind:amount={inputAmt}
						bind:error
						bind:inputId={id}
						{max}
						{decimals}
						{min}
						{disabled}
					/>
				{/if}
			{/key}
			{#if showMax}
				<div class="max-button-wrapper">
					<PillButton type="button" onclick={setToMax}>Max</PillButton>
				</div>
			{/if}
			{#if !hideUnit}
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
						{displayLabel}
					</div>
				{/if}
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
{:else if styleType === 'simple'}
	<div class="simple-wrapper">
		{#key [selected, debouncedMax, min]}
			<NumberInput bind:amount={inputAmt} bind:inputId={id} {max} {decimals} {min} {disabled} />
		{/key}
		{#if showUsd && inputAmt && inputAmt !== '0'}
			<span class="simple-usd">≈ ${inUsd}</span>
		{/if}
	</div>
{:else}
	<div class="big-wrapper">
		<div class="amount-input">
			<label for={id}>
				{displayLabel}
			</label>
			{#key [selected, debouncedMax, min]}
				<BigInput bind:amount={inputAmt} bind:inputId={id} {decimals} {min} {disabled} />
			{/key}
		</div>
	</div>
{/if}

<style lang="scss">
	.normal-wrapper,
	.big-wrapper {
		:global(input) {
			border: none;
			color: var(--dash-text-primary);
			font-family: 'Nunito Sans', sans-serif;
			&:focus-visible {
				box-shadow: none;
			}
			&::placeholder {
				color: var(--dash-text-muted);
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
			color: var(--dash-text-secondary);
			font-family: 'Nunito Sans', sans-serif;
			font-size: 0.8rem;
		}
		.balance-amount {
			font-family: 'Nunito Sans', sans-serif;
			font-weight: 400;
		}
		.amount-input {
			border: 1px solid rgba(255, 255, 255, 0.08);
			background: rgba(0, 0, 0, 0.25);
			color: var(--dash-text-primary);
			border-radius: 12px;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex-basis: 1;
			box-sizing: border-box;
			&:has(:global(input):focus-visible) {
				box-shadow: 0 -1px inset #6f6af8;
				border-bottom-color: #6f6af8;
				outline: none;
				border-radius: 12px 12px 0 0;
				hr {
					border-color: #6f6af8;
					border-width: 1.5px;
				}
			}

			hr {
				height: 1.5rem;
				border-right: 1px solid rgba(255, 255, 255, 0.08);
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
		.amount-input.borderless {
			border: none;
			background: transparent;
			box-shadow: none;
			padding: 0;
			&:has(:global(input):focus-visible) {
				box-shadow: none;
				border: none;
				border-radius: 0;
			}
			:global(.icons img:nth-child(2)) {
				display: none;
			}
		}
		.coin-label {
			width: 4rem;
			text-align: center;
			color: var(--dash-text-primary);
			font-family: 'Nunito Sans', sans-serif;
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
			color: var(--dash-text-muted);
			font-size: var(--text-sm);
			font-family: 'Nunito Sans', sans-serif;
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
	.simple-wrapper {
		:global(input) {
			border: none;
			background: transparent;
			color: var(--dash-text-primary);
			font-family: 'Nunito Sans', sans-serif;
			font-size: 1.25rem;
			font-weight: 600;
			padding: 0;
			width: 100%;
			height: auto;
			&:focus-visible {
				box-shadow: none;
				outline: none;
			}
			&::placeholder {
				color: var(--dash-text-muted);
			}
		}
		.simple-usd {
			display: block;
			color: var(--dash-text-muted);
			font-size: 0.7rem;
			font-family: 'Nunito Sans', sans-serif;
			margin-top: 0.25rem;
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
				color: var(--dash-text-primary);
				font-family: 'Nunito Sans', sans-serif;
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
