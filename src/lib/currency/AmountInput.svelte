<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { getContext, untrack } from 'svelte';
	import { Coin, Network } from '../send/sendOptions';
	import Dinero, { type Currency } from 'dinero.js';
	import { convert } from './convert';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { itemGroupLabelProps } from '@zag-js/menu';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';

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
	$effect(() => {
		inputDisabled = disabled;
	});
	let inUsd = $state('');
	let error = $state('');
	let coinIsUnknown = $derived(originalCoin.value == Coin.unk.value);
	$effect(() => {
		convert(Number(amountOfOriginalCoin), originalCoin, Coin.usd, Network.lightning).then(
			(amount) => {
				inUsd = new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumFractionDigits: 2,
					minimumFractionDigits: 2
				})
					.format(amount)
					.replaceAll(',', '');
			}
		);
		error = '';
	});

	let boundAmount = $state('');
	$effect(() => {
		convert(
			Number(amountOfOriginalCoin),
			untrack(() => originalCoin),
			value,
			Network.lightning
		).then((amount) => {
			boundAmount = new Intl.NumberFormat('en-US', {
				style: 'decimal',
				maximumFractionDigits: value.value == Coin.usd.value ? 2 : 8
			})
				.format(amount)
				.replaceAll(',', '');
		});
		error = '';
	});
	$effect(() => {
		if (coinIsUnknown) boundAmount = '';
	});
</script>

<label for={id}>
	<span>
		{label}
	</span>

	<div class={['amount-input', { disabled }]}>
		<CoinNetworkIcon coin={originalCoin} {network} />
		<input
			min="0.000000001"
			oninvalid={(e) => {
				e.preventDefault();
				error = 'Amount must be greater than zero.';
				const target = e.currentTarget;
				target.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
					inline: 'center'
				});
			}}
			oninput={(e) => {
				error = '';
				convert(Number(boundAmount), value, originalCoin, Network.lightning).then((newVal) => {
					amountOfOriginalCoin = new Intl.NumberFormat('en-US', {
						style: 'decimal',
						maximumFractionDigits: 8
					})
						.format(newVal)
						.replaceAll(',', '');
					if (oninput) oninput(e);
				});
			}}
			onchange={() => {
				console.log('HERE CHANGED');
				const amount =
					amountOfOriginalCoin == ''
						? undefined
						: convert(Number(amountOfOriginalCoin), originalCoin, value, Network.lightning);
				inputDisabled = true;
				if (amount == undefined) return;
				amount.then((amount) => {
					boundAmount = new Intl.NumberFormat('en-US', {
						style: 'decimal',
						maximumFractionDigits: value.value == Coin.usd.value ? 2 : 8
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
				{disabled}
				items={selectItems}
				initial={originalCoin.label}
				onValueChange={(v) => {
					console.log(v);

					if (v.items[0] == undefined) return;
					if (v.items[0].value == Coin.unk.value) return;
					if (value == undefined || value.value == Coin.unk.value) {
						value = v.items[0];
						return;
					}
					if (v.items[0].value == value.value) return;
					if (boundAmount != undefined) {
						convert(Number(boundAmount), value, v.items[0], Network.lightning).then((amount) => {
							boundAmount = new Intl.NumberFormat('en-US', {
								style: 'decimal',
								maximumFractionDigits: value.value == Coin.usd.value ? 2 : 8
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
			Approx. USD value:
			{#if originalCoin.value != Coin.unk.value}
				${inUsd}
			{:else}
				Unk
			{/if}
		</span>
	{/if}
	{#if error != ''}
		<span class="error">
			{error}
		</span>
	{/if}
</label>

<style lang="scss">
	.approx-usd {
		text-wrap: wrap;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		margin-bottom: 0;
	}
	.disabled {
		--bg: var(--neutral-bg-accent);
		background-color: var(--neutral-bg-accent);
	}
	label {
		--bg: var(--neutral-off-bg);
		display: block;
		margin-left: 0;
		flex-grow: 1;
		width: 100%;
		flex-basis: 30%;
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
		margin-right: 0.25rem;
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
