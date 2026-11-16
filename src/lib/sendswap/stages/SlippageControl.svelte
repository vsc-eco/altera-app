<script lang="ts">
	/**
	 * The slippage chips, plus the "Custom" input they collapse into.
	 *
	 * Lifted out of SwapOptions whole: the four chips, the focus-and-select
	 * effect, the validation and the parse-and-clamp all only ever concerned
	 * this one control, and they accounted for about 40 lines of the swap
	 * screen's script and 90 of its markup.
	 *
	 * The clamping and the percent↔bps conversion come from `$lib/calc`, like
	 * every other number in the app.
	 */
	import { bpsToPct, clampSlippagePct, pctToBps } from '$lib/calc';

	let {
		slippageBps = $bindable(),
		options = [50, 100, 200, 300]
	}: {
		/** Tolerance in basis points — 100 = 1%. */
		slippageBps: number;
		/** The preset chips, in bps. */
		options?: number[];
	} = $props();

	let customOpen = $state(false);
	let customInput = $state('');
	let inputEl: HTMLInputElement | null = $state(null);

	/** Open the custom field focused, with whatever is there selected. */
	$effect(() => {
		if (customOpen && inputEl) {
			inputEl.focus();
			inputEl.select();
		}
	});

	/** Red border while the raw text cannot be a tolerance. Checked as you
	 *  type; only committed on blur or Enter. */
	const invalid = $derived.by(() => {
		if (!customInput.trim()) return false;
		const v = parseFloat(customInput.replace(',', '.'));
		return isNaN(v) || v <= 0 || v > 99.99;
	});

	const isPreset = $derived(options.includes(slippageBps));

	function apply() {
		const raw = customInput.replace(',', '.').trim();
		if (!raw) return (customOpen = false);
		const v = parseFloat(raw);
		if (isNaN(v) || v <= 0) return (customOpen = false);
		const clamped = clampSlippagePct(v);
		// At most 2 decimals, trailing zeroes stripped.
		customInput = parseFloat(clamped.toFixed(2)).toString();
		slippageBps = pctToBps(clamped);
		// Collapse back to a chip showing the custom value.
		customOpen = false;
	}

	/** `reset()` is called by the host when Advanced is switched off. */
	export function reset(bps: number) {
		customOpen = false;
		slippageBps = bps;
	}
</script>

<div class="slippage-options" role="group" aria-label="Slippage tolerance">
	{#each options as bps (bps)}
		<button
			type="button"
			class={{ active: slippageBps === bps && !customOpen }}
			onclick={() => {
				slippageBps = bps;
				customOpen = false;
			}}
		>
			{bpsToPct(bps).toFixed(bps % 100 === 0 ? 0 : 1)}%
		</button>
	{/each}

	{#if customOpen}
		<div class="custom-slippage" class:invalid>
			<input
				bind:this={inputEl}
				type="text"
				inputmode="decimal"
				placeholder="0.5"
				aria-label="Custom slippage tolerance, percent"
				aria-invalid={invalid}
				bind:value={customInput}
				oninput={() => {
					// Normalise the decimal separator as you type; validate on commit.
					customInput = customInput.replace(',', '.');
				}}
				onblur={apply}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						apply();
						e.currentTarget.blur();
					}
					if (e.key === 'Escape') customOpen = false;
				}}
			/>
			<span class="custom-slippage-unit">%</span>
		</div>
	{:else}
		<button
			type="button"
			class={{ active: !isPreset }}
			onclick={() => {
				customOpen = true;
				customInput = isPreset ? '' : parseFloat(bpsToPct(slippageBps).toFixed(2)).toString();
			}}
		>
			{isPreset ? 'Custom' : `${parseFloat(bpsToPct(slippageBps).toFixed(2))}%`}
		</button>
	{/if}
</div>

<style lang="scss">
	.slippage-options {
		box-sizing: border-box;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-width: 0;

		button {
			box-sizing: border-box;
			padding: 0.2rem 0.5rem;
			border: 1px solid var(--dash-card-border);
			border-radius: 0.5rem;
			background: transparent;
			color: var(--dash-text-secondary);
			font: inherit;
			font-size: var(--text-xs);
			font-weight: 600;
			cursor: pointer;
			transition:
				background-color 0.15s ease,
				border-color 0.15s ease,
				color 0.15s ease;

			&:hover {
				border-color: var(--dash-accent-purple);
				color: var(--dash-text-primary);
			}
			&.active {
				background: rgba(111, 106, 248, 0.18);
				border-color: var(--dash-accent-purple);
				color: var(--dash-text-primary);
			}
		}
	}

	.custom-slippage {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--dash-accent-purple);
		border-radius: 0.5rem;
		background: rgba(111, 106, 248, 0.12);

		&.invalid {
			border-color: var(--negative-text, #f87171);
		}

		input {
			width: 3ch;
			min-width: 3ch;
			border: none;
			background: transparent;
			color: var(--dash-text-primary);
			font: inherit;
			font-size: var(--text-xs);
			font-weight: 600;
			text-align: right;
			padding: 0;
			&:focus {
				outline: none;
			}
			/* Chrome/Safari spinners would overlap the % sign. */
			&::-webkit-outer-spin-button,
			&::-webkit-inner-spin-button {
				appearance: none;
				margin: 0;
			}
		}
	}
	.custom-slippage-unit {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--dash-text-secondary);
	}
</style>
