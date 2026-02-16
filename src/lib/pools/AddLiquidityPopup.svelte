<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import Select from '$lib/zag/Select.svelte';
	import { poolsSampleData } from '$lib/pools/poolsSampleData';
	import type { PoolRow } from '$lib/pools/poolsSampleData';

	let { open = $bindable(false), toggle = $bindable() } = $props();
	let dialogToggle = $state<(o?: boolean) => void>(() => {});

	$effect(() => {
		if (open) dialogToggle(true);
		else selectedPool = null;
	});

	let selectedPool = $state<PoolRow | null>(null);
	let amount0 = $state('');
	let amount1 = $state('');
	let priceImpactTolerance = $state('1');

	const poolOptions = $derived(
		poolsSampleData.map((p) => ({ value: p.id, label: p.pair }))
	);

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		selectedPool = poolsSampleData.find((p) => p.id === id) ?? null;
		amount0 = '';
		amount1 = '';
	}

	function setMax(side: 0 | 1) {
		// Placeholder: would use actual balance
		if (side === 0) amount0 = '0';
		if (side === 1) amount1 = '0';
	}
</script>

<Dialog bind:open bind:toggle={dialogToggle}>
	{#snippet title()}
		Add Liquidity
	{/snippet}
	{#snippet content()}
		<div class="add-liquidity-form">
			<div class="field">
				<span class="label">Pool</span>
				<Select
					items={poolOptions}
					styleType="dropdown"
					placeholder="Select pool"
					onValueChange={onPoolChange}
				/>
			</div>

			{#if selectedPool}
				<div class="form-section">
					<!-- TOKEN A -->
					<div class="asset-card">
						<div class="asset-header">
							<div class="label">
								<span class="asset-icon icon-a"></span>
								{selectedPool.pairSymbols[0]}
							</div>
							<span class="balance">Balance: 0</span>
						</div>

						<div class="input-wrap">
							<input
								type="text"
								bind:value={amount0}
								placeholder="0"
								inputmode="decimal"
							/>
							<button class="max-btn" onclick={() => setMax(0)}>
								Max
							</button>
						</div>
					</div>

					<!-- TOKEN B -->
					<div class="asset-card">
						<div class="asset-header">
							<div class="label">
								<span class="asset-icon icon-b"></span>
								{selectedPool.pairSymbols[1]}
							</div>
							<span class="balance">Balance: 0</span>
						</div>

						<div class="input-wrap">
							<input
								type="text"
								bind:value={amount1}
								placeholder="0"
								inputmode="decimal"
							/>
							<button class="max-btn" onclick={() => setMax(1)}>
								Max
							</button>
						</div>
					</div>

					<!-- RATE -->
					<div class="rate-info">
						<p>
							1 {selectedPool.pairSymbols[0]} = {selectedPool.priceRatio}
						</p>
						<p>
							1 {selectedPool.pairSymbols[1]} = {selectedPool.priceInverse}
						</p>
					</div>

					<div class="field tolerance-row">
						<label for="add-liq-tolerance" class="label">Maximum price impact tolerance</label>
						<div class="tolerance-input">
							<input id="add-liq-tolerance" type="text" bind:value={priceImpactTolerance} inputmode="decimal" aria-label="Maximum price impact tolerance percent" />
							<span class="suffix">%</span>
						</div>
					</div>

					<button class="add-liquidity-btn">Add Liquidity</button>
				</div>
			{/if}
		</div>
	{/snippet}
</Dialog>

<style lang="scss">
	.add-liquidity-form {
		min-width: 28rem;
		max-width: 100%;
		box-sizing: border-box;
	}

	/* Select trigger and dropdown use full form width so pool names don't truncate */
	.add-liquidity-form :global([data-part='root']) {
		width: 100%;
		min-width: 0;
	}
	.add-liquidity-form :global([data-part='control']) {
		min-width: 100%;
	}
	.add-liquidity-form :global([data-part='trigger']) {
		min-width: 100%;
		box-sizing: border-box;
	}
	.add-liquidity-form :global([data-part='positioner']) {
		z-index: 9999 !important;
		min-width: var(--reference-width);
		box-sizing: border-box;
	}
	.add-liquidity-form :global([data-part='content']) {
		max-height: 260px;
		overflow-y: auto;
		overflow-x: visible;
		min-width: 100%;
	}
	.add-liquidity-form :global([data-part='item-text']) {
		overflow: visible;
		white-space: nowrap;
	}

/* spacing */
.field {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}


.label {
	font-size: 14px;
	color: var(--neutral-fg-mid);
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.form-section {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

/* TOKEN CARD */
.asset-card {
	background: var(--neutral-bg);
	border: 1px solid var(--neutral-bg-accent);
	border-radius: 0.9rem;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

/* HEADER ROW */
.asset-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.balance {
	font-size: 12px;
	color: var(--neutral-fg-mid);
}

/* ICON */
.asset-icon {
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: var(--primary-bg-mid);
}

.asset-icon.icon-b {
	background: var(--primary-bg-accent);
}

/* INPUT */
.input-wrap {
	display: flex;
	align-items: center;
	border: 1px solid var(--neutral-bg-accent-shifted);
	background: var(--neutral-off-bg);
	border-radius: 0.6rem;
	padding: 0.65rem 0.75rem;
	gap: 0.5rem;
}

.input-wrap input {
	flex: 1;
	background: none;
	border: none;
	color: var(--neutral-fg);
	font-size: 16px;
}

.input-wrap input:focus {
	outline: none;
}

.max-btn {
	font-size: 12px;
	color: var(--primary-fg-accent);
	background: var(--neutral-bg-accent);
	border: none;
	padding: 0.35rem 0.6rem;
	border-radius: 0.4rem;
	cursor: pointer;
}

/* RATE */
.rate-info {
	background: var(--neutral-bg);
	border: 1px solid var(--neutral-bg-accent);
	border-radius: 0.8rem;
	padding: 0.75rem 1rem;
	font-size: 14px;
	color: var(--neutral-fg-mid);
}

/* TOLERANCE */
.tolerance-input {
	display: flex;
	align-items: center;
	border: 1px solid var(--neutral-bg-accent-shifted);
	background: var(--neutral-off-bg);
	border-radius: 0.6rem;
	padding: 0.6rem 0.75rem;
}

.tolerance-input input {
	flex: 1;
	border: none;
	background: none;
	color: var(--neutral-fg);
	font-size: 15px;
}

.tolerance-input input:focus {
	outline: none;
}

/* BUTTON */
.add-liquidity-btn {
	width: 100%;
	padding: 1rem;
	border-radius: 0.8rem;
	font-size: 16px;
	font-weight: 500;
	background: var(--primary-bg-mid);
	color: var(--primary-fg-accent);
	border: none;
	cursor: pointer;
}

.add-liquidity-btn:hover {
	background: var(--primary-bg-accent);
}
</style>
