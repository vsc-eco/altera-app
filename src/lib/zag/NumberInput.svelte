<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import * as numberInput from '@zag-js/number-input';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { untrack } from 'svelte';

	type Props = {
		amount: string;
		error: string;
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

	let value = $state('');

	const id = $props.id();
	const service = $derived(
		useMachine(numberInput.machine, {
			id,
			min: min,
			max: max,
			allowOverflow: true,
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
				error = '';
				value = details.value;
				invalid = details.value !== '' && !inRange(details.valueAsNumber);
				amount = details.valueAsNumber.toString();
			},
			onValueInvalid(details) {
				if (details.reason === 'rangeUnderflow') {
					error = 'Amount must be greater than zero.';
				} else {
					error = 'Amount exceeds available balance.';
				}
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
			if (amount !== api.valueAsNumber.toString()) {
				value = amount;
			}
		});
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getScrubberProps()}></div>
	<input {...api.getInputProps()} class={{ invalid }} />
	<div class="triggers">
		<button {...api.getIncrementTriggerProps() as ButtonAttributes}>
			<ChevronUp />
		</button>
		<button {...api.getDecrementTriggerProps() as ButtonAttributes}>
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
		flex-grow: 1;
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
		color: var(--fg-accent-shifted);
		&:hover {
			color: var(--fg-accent);
		}
		&:active {
			color: var(--fg);
			transform: scale(0.98);
		}
	}
</style>
