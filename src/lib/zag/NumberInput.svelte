<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import * as numberInput from '@zag-js/number-input';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { untrack } from 'svelte';

	type Props = {
		amount: string;
		error?: string;
		decimals?: number;
		min?: number;
		max?: number;
		inputId?: string;
	};
	let {
		amount = $bindable(),
		error = $bindable(),
		decimals = 2,
		min: minProp,
		max = Number.MAX_SAFE_INTEGER,
		inputId = $bindable()
	}: Props = $props();

	let min = minProp ?? 10 ** -decimals;

	function inRange(val: number) {
		return val >= min && val <= max;
	}
	let invalid = $state(false);
	function trimOutput(val: number) {
		if (Number.isNaN(val)) {
			return '';
		}
		return Number(val.toFixed(decimals)).toString();
	}

	let value = $state('');

	function setErrors(amt: number) {
		if (amt < min) {
			error = `Amount must be at least ${min.toFixed(decimals)}`;
		} else if (amt > max) {
			error = 'Amount exceeds available balance';
		}
	}
	$effect(() => {
		max;
		min;
		if (amount) setErrors(Number(amount));
	});

	const id = $props.id();
	const service = $derived(
		useMachine(numberInput.machine, {
			id,
			min: 0,
			step: 10 ** -decimals,
			allowOverflow: false,
			formatOptions: {
				style: 'decimal',
				useGrouping: true,
				minimumFractionDigits: 0,
				maximumFractionDigits: decimals
			},
			get value() {
				return value;
			},
			onValueChange(details) {
				value = details.value;
				if (error !== undefined) {
					invalid = details.value !== '' && !inRange(details.valueAsNumber);
					if (!invalid) error = '';
				}
				amount = trimOutput(api.valueAsNumber);
				setErrors(details.valueAsNumber);
			}
		})
	);
	const api = $derived(numberInput.connect(service, normalizeProps));
	$effect(() => {
		const forId = api.getLabelProps().for ?? undefined;
		if (inputId !== forId) inputId = forId;
	});
	$effect(() => {
		if (!amount) return;
		untrack(() => {
			if (amount !== trimOutput(api.valueAsNumber)) {
				value = amount;
				if (error !== undefined) {
					invalid = value !== '' && !inRange(Number(value));
					if (!invalid) error = '';
				}
			}
		});
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getScrubberProps()}></div>
	<input {...api.getInputProps()} class={{ invalid }} />
	<div class="triggers">
		<button {...api.getIncrementTriggerProps()}>
			<ChevronUp />
		</button>
		<button {...api.getDecrementTriggerProps()}>
			<ChevronDown />
		</button>
	</div>
</div>

<style lang="scss">
	[data-part='root'] {
		display: flex;
		align-items: center;
		position: relative;
		flex-grow: 1;
	}
	.triggers {
		display: flex;
		flex-direction: column;
		position: absolute;
		right: 0;
	}
	[data-part='input'] {
		width: 0;
		flex-grow: 1;
		padding-right: 2rem;
		&.invalid {
			color: var(--secondary-fg-mid);
		}
	}
	[data-part='increment-trigger'],
	[data-part='decrement-trigger'] {
		height: 1rem;
		border: none;
		background-color: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--neutral-fg-accent-shifted);
		&:hover {
			color: var(--neutral-fg-accent);
		}
		&:active {
			color: var(--fg);
			transform: scale(0.98);
		}
	}
</style>
