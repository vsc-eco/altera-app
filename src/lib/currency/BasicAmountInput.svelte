<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import { Coin, Network, type SendDetails } from '../send/sendOptions';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import CoinNetworkIcon from './CoinNetworkIcon.svelte';
	import { CoinAmount } from './CoinAmount';
	import { isValidBalanceField, type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import PillButton from '$lib/PillButton.svelte';

	let {
		details = $bindable(),
		id
	}: {
		details: SendDetails;
		id: string;
	} = $props();

	let inUsd = $state('');
	let error = $state('');
	let currentCoin = $state.raw(coins.usd);
	let coinAmount = $derived(new CoinAmount(details.fromAmount, currentCoin));
	let boundAmount: string | null = $state(null);

	const maxField: BalanceOption | undefined = $derived.by(() => {
		if (!currentCoin) return undefined;
		if (isValidBalanceField(currentCoin.value)) {
			return currentCoin.value as BalanceOption;
		}
	});
	let showMax = $derived(
		maxField !== undefined &&
			new CoinAmount($accountBalance.bal[maxField], currentCoin, true).toAmountString() !==
				new CoinAmount(boundAmount ?? 0, currentCoin).toAmountString()
	);
	$effect(() => {
		// makes it reactive to boundAmount, which is only in a "then" otherwise
		const newCoinOpt = details.fromCoin;
		if (!newCoinOpt) {
			return;
		}
		untrack(() => {
			const originalAmount = new CoinAmount(details.fromAmount, currentCoin, true);
			if (originalAmount.toNumber() === 0) {
				return;
			}
			originalAmount
				.convertTo(newCoinOpt.coin, Network.lightning)
				.then((amount) => {
					details.fromAmount = amount.toAmountString(true);
					boundAmount = details.fromAmount;
				})
				.catch(() => {});
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
		if (maxField && details.fromCoin) {
			return new CoinAmount(
				$accountBalance.bal[maxField],
				details.fromCoin.coin,
				true
			).toAmountString();
		}
		return undefined;
	});

	$effect(() => {
		console.log('fromAmt, boundAmt', details.fromAmount, boundAmount);
	});

	function setToMax() {
		details.fromAmount = maxBalance ?? '0';
		boundAmount = maxBalance ?? '0';
	}
</script>

<div class="wrapper">
	<label for={id}>
		<span>
			{#if maxField}
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
		<CoinNetworkIcon
			coin={details.fromCoin?.coin ?? coins.usd}
			network={details.fromNetwork ?? Network.unknown}
		/>
		<input
			min="0.000000001"
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
			oninput={(e) => {
				error = '';
			}}
			onchange={() => {
				if (boundAmount) {
					details.fromAmount = new CoinAmount(boundAmount, currentCoin).toAmountString();
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
	<span class={["approx-usd", {hidden: !maxField}]}>
		Approx. USD value:
		{#if details.fromCoin?.coin.value != Coin.unk.value}
			${inUsd}
		{:else}
			Unknown
		{/if}
	</span>
	{#if error != ''}
		<span class="error">
			{error}
		</span>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		position: relative;
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
		margin-right: 0.25rem;
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
		&.hidden {
			visibility: hidden;
		}
	}
</style>
