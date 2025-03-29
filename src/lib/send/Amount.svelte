<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { Coin, Network } from './sendOptions';

	let {
		coin,
		network,
		amount = $bindable(),
		label,
		id,
		defaultUnit: baseUnit = $bindable()
	}: {
		coin: Coin;
		network: Network;
		amount?: string;
		id: string;
		label: string;
		defaultUnit: string;
	} = $props();
</script>

<label for={id}>
	<span>
		{label}
	</span>

	<div class="amount-input">
		<span class="icons">
			<img width="24" src={coin.icon} alt={coin.label} />
			<img width="12" src={network.icon} alt={network.label} />
		</span>
		<input name={label} {id} type="number" step="any" bind:value={amount} inputmode="numeric" />
		<hr />
		<Select
			items={[
				{
					label: baseUnit
				},
				{
					label: 'USD'
				}
			]}
			initial={baseUnit}
		/>
	</div>
</label>

<style lang="scss">
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
	.amount-input {
		border: 1px solid var(--neutral-bg-accent-shifted);
		color: var(--neutral-fg);
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
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
			min-width: 5rem;
			width: 2rem;
			flex-grow: 1;
		}
		input:focus-visible {
			box-shadow: none;
		}
	}
	// to hide the arrows on the number input
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
	}
</style>
