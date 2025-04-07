<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { getContext, untrack } from 'svelte';
	import { Coin, Network } from '../send/sendOptions';
	import Dinero, { type Currency } from 'dinero.js';
	import { convert } from './convert';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { itemGroupLabelProps } from '@zag-js/menu';

	let {
		coin: originalCoin,
		network,
		originalAmount: amountOfOriginalCoin = $bindable(),
		label,
		id,
		required,
		selectItems,
		oninput,
		disabled
	}: {
		coin: Coin;
		network: Network;
		originalAmount?: string;
		id: string;
		label: string;
		required?: boolean;
		selectItems: Coin[];
		oninput?: HTMLInputAttributes['oninput'];
		disabled?: boolean;
	} = $props();
	let value: Coin = $state(originalCoin);
	$effect(() => {
		value = originalCoin;
	});
	let inputDisabled = $state(disabled);
	let inUsd = $state('');
	$effect(() => {
		convert(
			Number(amountOfOriginalCoin),
			untrack(() => originalCoin),
			Coin.usd,
			Network.lightning
		).then((amount) => {
			inUsd = new Intl.NumberFormat('en-US', {
				style: 'decimal',
				maximumFractionDigits: 2,
				minimumFractionDigits: 2
			})
				.format(amount)
				.replaceAll(',', '');
		});
	});

	let boundAmount = $state('');
	$inspect(amountOfOriginalCoin);
	$effect(() => {
		convert(
			Number(amountOfOriginalCoin),
			untrack(() => originalCoin),
			value,
			Network.lightning
		).then((amount) => {
			console.log('HERERESWI', amount);
			boundAmount = new Intl.NumberFormat('en-US', {
				style: 'decimal',
				maximumFractionDigits: 8
			})
				.format(amount)
				.replaceAll(',', '');
		});
	});
</script>

<label for={id}>
	<span>
		{label}
	</span>

	<div class="amount-input">
		<span class="icons">
			<img width="24" src={originalCoin.icon} alt={originalCoin.label} />
			<img width="12" src={network.icon} alt={network.label} />
		</span>

		<input
			oninput={(e) => {
				console.log('AMOUNT CHANGED');
				convert(Number(boundAmount), value, originalCoin, Network.lightning).then((newVal) => {
					console.log('NEW VALUE ', newVal);
					amountOfOriginalCoin = new Intl.NumberFormat('en-US', {
						style: 'decimal',
						maximumFractionDigits: 8
					})
						.format(newVal)
						.replaceAll(',', '');
					console.log('EHRE');
					if (oninput) oninput(e);
				});
			}}
			onchange={() => {
				const amount =
					amountOfOriginalCoin == ''
						? undefined
						: convert(Number(amountOfOriginalCoin), originalCoin, value, Network.lightning);
				inputDisabled = true;
				if (amount == undefined) return;
				amount.then((amount) => {
					boundAmount = new Intl.NumberFormat('en-US', {
						style: 'decimal',
						maximumFractionDigits: 8
					})
						.format(amount)
						.replaceAll(',', '');
					inputDisabled = disabled;
				});
			}}
			{required}
			name={label}
			{id}
			type="number"
			step="any"
			inputmode="numeric"
			bind:value={boundAmount}
			disabled={inputDisabled}
		/>
		<hr />
		<div class="currency-select">
			<Select
				items={selectItems}
				initial={originalCoin.label}
				onValueChange={(v) => {
					if (v.items[0] == undefined) return;
					if (value == undefined) {
						value = v.items[0];
						return;
					}
					if (v.items[0].unit == value.unit) return;
					console.log(`Converting from ${value.unit} to ${v.items[0].unit}`);
					if (boundAmount != undefined) {
						convert(Number(boundAmount), value, v.items[0], Network.lightning).then((amount) => {
							boundAmount = new Intl.NumberFormat('en-US', {
								style: 'decimal',
								maximumFractionDigits: 8
							})
								.format(amount)
								.replaceAll(',', '');
							value = v.items[0];
						});
					} else value = v.items[0];
				}}
			/>
		</div>
	</div>
	{#if amountOfOriginalCoin != ''}
		<span class="approx-usd">
			Approx. USD value: ${inUsd}
		</span>
	{/if}
</label>

<style lang="scss">
	.approx-usd {
		text-wrap: wrap;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
	}
	label {
		display: block;
		margin-left: 0;
		flex-grow: 1;
		flex-basis: 40%;
		> span {
			display: inline-block;
			margin: 0.5rem;
		}
	}
	.currency-select {
		padding: 0 0.25rem;
	}
	.amount-input {
		:global(button) {
			margin: 0;
		}
		border: 1px solid var(--neutral-bg-accent-shifted);
		color: var(--neutral-fg);
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		flex-basis: 1;
		max-width: 16rem;
		box-sizing: border-box;
		&:has(input:focus-visible) {
			box-shadow: 0 -1px inset var(--primary-bg-mid);
			border-bottom-color: var(--primary-bg-mid);
			outline: none;
			border-radius: 0.5rem 0.5rem 0 0;
		}

		.icons {
			align-items: center;
			border-radius: 0.5rem 0 0 0.5rem;
			border-right-width: 0;
			padding: 0.25rem;
			height: 3rem;
			padding-left: 0.5rem;
			width: 2.25rem;
			box-sizing: border-box;
			display: inline-flex;
			position: relative;
			justify-content: left;
			align-items: center;
			img:last-child {
				background-color: var(--neutral-off-bg);
				position: absolute;
				border: 2px solid var(--neutral-off-bg);
				border-radius: 50%;
				bottom: 0.5rem;
				left: 16px;
			}
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
	}
</style>
