<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import * as numberInput from '@zag-js/number-input';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import { untrack } from 'svelte';

	type Props = {
		amount: string;
		decimals?: number;
		max?: number;
		min?: number;
		inputId?: string;
	};
	let {
		amount = $bindable(),
		decimals = 2,
		max = Number.MAX_SAFE_INTEGER,
		min: minParam,
		inputId = $bindable()
	}: Props = $props();

	let min = $derived(minParam ?? 10 ** -decimals);

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

	const id = $props.id();
	const service = $derived(
		useMachine(numberInput.machine, {
			id,
			min: 0,
			max: max,
			allowOverflow: false,
			get value() {
				return value;
			},
			formatOptions: {
				style: 'decimal',
				useGrouping: true,
				minimumFractionDigits: 0,
				maximumFractionDigits: decimals
			},
			onValueChange(details) {
				value = details.value;
				invalid = details.value !== '' && !inRange(details.valueAsNumber);
				amount = inRange(details.valueAsNumber) ? trimOutput(api.valueAsNumber) : '';
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
				value = parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: decimals });
				invalid = value !== '' && !inRange(Number(value));
				if (inRange(api.valueAsNumber)) {
					invalid = false;
				}
			}
		});
	});
	let width = $state(0);
	let inputElement = $state<HTMLInputElement>();
	$effect(() => {
		inputElement?.style.setProperty('--width', `${width.toString()}px`);
	});
</script>

<div {...api.getRootProps()}>
	<div {...api.getScrubberProps()}></div>
	<input bind:this={inputElement} {...api.getInputProps()} class={{ invalid }} placeholder="0" />
	<span bind:clientWidth={width}>{value || '0'}</span>
</div>

<style lang="scss">
	[data-part='root'] {
		display: flex;
		align-items: center;
		position: relative;
		width: min-content;
	}
	[data-part='input'] {
		position: absolute;
		font-size: 3rem;
		min-width: 0;
		width: var(--width);
		height: auto;
		padding: 0;
		&.invalid {
			color: var(--secondary-fg-mid);
		}
		border: none;
		&:focus-visible {
			box-shadow: none;
		}
	}
	span {
		font-size: 3rem;
		visibility: hidden;
		pointer-events: none;
		max-width: calc(100vw - 2rem - 80px);
	}
</style>
