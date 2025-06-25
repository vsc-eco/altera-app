<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import { Coin, Network } from '../send/sendOptions';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import { accountBalance, type BalanceOption } from '$lib/balances';
	import PillButton from '$lib/PillButton.svelte';

	let {
		coin: originalCoin,
		network,
		originalAmount: amountOfOriginalCoin = $bindable(),
		label,
		id,
		required,
		selectItems,
		oninput,
		disabled,
		maxField
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
		maxField?: BalanceOption;
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
		new CoinAmount(amountOfOriginalCoin ?? '0', originalCoin)
			.convertTo(Coin.usd, Network.lightning)
			.then((amount) => {
				inUsd = amount.toAmountString();
			});
		error = '';
	});

	let boundAmount = $state('');
	$effect(() => {
		new CoinAmount(
			Number(amountOfOriginalCoin),
			untrack(() => originalCoin)
		)
			.convertTo(value, Network.lightning)
			.then((amount) => {
				boundAmount = amount.toAmountString();
			});
		error = '';
	});
	$effect(() => {
		if (coinIsUnknown) boundAmount = '';
	});
	let maxCoin = $derived.by(() => {
		if (maxField) {
			if (['hbd', 'hbd_savings', 'pending_hbd_unstaking'].includes(maxField)) {
				return Coin.hbd;
			} else {
				return Coin.hive;
			}
		}
		return Coin.unk;
	});
	let maxBalance = $derived.by(() => {
		if (maxField) {
			return new CoinAmount($accountBalance[maxField], maxCoin, true).toAmountString();
		}
		return undefined;
	});
	let maxInputField = $derived.by(() => {
		if (maxField) {
			return new CoinAmount($accountBalance[maxField], value, true).toAmountString();
		}
		return undefined;
	});

	function setToMax() {
		amountOfOriginalCoin = maxBalance ?? '0';
		new CoinAmount(Number(maxBalance ?? '0'), originalCoin)
			.convertTo(value, Network.lightning)
			.then((amount) => {
				boundAmount = amount.toAmountString();
				// Call oninput if it exists (sets connected fields)
				if (oninput) {
					const inputElement = document.getElementById(id) as HTMLInputElement;
					if (inputElement) {
						const event = { currentTarget: inputElement } as any;
						oninput(event);
					}
				}
			});
	}
</script>

<label for={id}>
	<span>
		{label}<wbr />
		{#if maxField}
			<span style="white-space: nowrap;">
				(Balance:
				<button type="button" class="balance-link" onclick={setToMax}
					>{new CoinAmount($accountBalance[maxField], maxCoin, true).toPrettyString()}
				</button>
				)
			</span>
		{/if}
	</span>

	<div class={['amount-input', { disabled }]}>
		<CoinNetworkIcon coin={originalCoin} {network} />
		<input
			min="0.000000001"
			max={maxInputField}
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
			oninput={(e) => {
				error = '';
				if (maxField && Number(amountOfOriginalCoin) > $accountBalance[maxField]) {
					error = 'Amount exceeds available balance.';
				}
				new CoinAmount(Number(boundAmount), value)
					.convertTo(originalCoin, Network.lightning)
					.then((newVal) => {
						amountOfOriginalCoin = newVal.toAmountString();
						if (oninput) oninput(e);
					});
			}}
			onchange={() => {
				console.log('HERE CHANGED');
				if (maxField && Number(amountOfOriginalCoin) > $accountBalance[maxField]) {
					error = 'Amount exceeds available balance.';
				}
				const amount =
					amountOfOriginalCoin == ''
						? undefined
						: new CoinAmount(Number(amountOfOriginalCoin), originalCoin).convertTo(
								value,
								Network.lightning
							);
				inputDisabled = true;
				if (amount == undefined) return;
				amount.then((amount) => {
					boundAmount = amount.toAmountString();
					inputDisabled = disabled;
				});
			}}
			{required}
			name={label}
			{id}
			type="number"
			step="any"
			inputmode="decimal"
			bind:value={boundAmount}
			disabled={inputDisabled}
		/>
		{#if maxField}
			<div class="max-button-wrapper">
				<PillButton type="button" onclick={setToMax}>Max</PillButton>
			</div>
		{/if}
		<hr />
		<div class="currency-select">
			{#if selectItems.length > 1}
				<Select
					{disabled}
					items={selectItems}
					initial={originalCoin.label}
					onValueChange={(v) => {
						// console.log(v);

						if (v.items[0] == undefined) return;
						if (v.items[0].value == Coin.unk.value) return;
						if (value == undefined || value.value == Coin.unk.value) {
							value = v.items[0];
							return;
						}
						if (v.items[0].value == value.value) return;
						if (boundAmount != undefined) {
							new CoinAmount(Number(boundAmount), value)
								.convertTo(v.items[0], Network.lightning)
								.then((amount) => {
									boundAmount = amount.toAmountString();
									value = v.items[0];
								});
						} else value = v.items[0];
					}}
				/>
			{:else}
				<div class="single-coin">
					{selectItems[0].label}
				</div>
			{/if}
		</div>
	</div>
	{#if amountOfOriginalCoin != ''}
		<span class="approx-usd">
			Approx. USD value:
			{#if originalCoin.value != Coin.unk.value}
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
		.max-button-wrapper {
			margin-right: 0.25rem;
			:global(button) {
				font-size: var(--text-sm);
				padding: 0.5rem 0.75rem;
				height: fit-content;
			}
		}
	}
	.balance-link {
		background: none;
		border: none;
		padding: 0;
		color: var(--primary-mid);
		cursor: pointer;
		font: inherit;

		&:hover {
			color: var(--primary-bg-mid);
		}
	}
	.single-coin {
		padding: 0.75rem;
	}
</style>
