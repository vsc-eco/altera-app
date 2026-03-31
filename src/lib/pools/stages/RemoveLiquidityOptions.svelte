<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';
	import { removeLiquidityDraftStore } from '$lib/pools/removeLiquidityStore';

	let { editStage, pools = [] }: { editStage: (complete: boolean) => void; pools: PoolRow[] } = $props();

	let selectedPool = $state<PoolRow | null>(null);
	let lpAmount = $state('');

	const poolOptions = $derived(
		pools.map((p) => ({ value: p.id, label: p.pair }))
	);

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		selectedPool = pools.find((p) => p.id === id) ?? null;
		lpAmount = '';
	}

	function onLpAmountInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		lpAmount = value.replace(/[^\d]/g, '');
	}

	const parsedLpAmount = $derived(lpAmount ? Number(lpAmount) : 0);
	const hasError = $derived(!Number.isInteger(parsedLpAmount) || parsedLpAmount <= 0);

	$effect(() => {
		removeLiquidityDraftStore.set({
			selectedPool,
			lpAmount: parsedLpAmount,
			hasError
		});
		editStage(!!selectedPool && !hasError);
	});
</script>

<div class="remove-liquidity-form">
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
			<div class="field">
				<label for="remove-liq-lp-amount" class="label">LP amount to burn</label>
				<div class="input-wrap">
					<input
						id="remove-liq-lp-amount"
						type="text"
						value={lpAmount}
						oninput={onLpAmountInput}
						placeholder="0"
						inputmode="numeric"
						aria-label="LP amount to remove"
					/>
				</div>
			</div>

			<div class="position-info">
				<span class="label">You will receive (estimated)</span>
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">
							<span class="asset-icon icon-a"></span>
							{selectedPool.pairSymbols[0]}
						</div>
						<span class="balance">~0</span>
					</div>
				</div>
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">
							<span class="asset-icon icon-b"></span>
							{selectedPool.pairSymbols[1]}
						</div>
						<span class="balance">~0</span>
					</div>
				</div>
			</div>

			<div class="rate-info">
				<p>1 {selectedPool.pairSymbols[0]} = {selectedPool.priceRatio}</p>
				<p>1 {selectedPool.pairSymbols[1]} = {selectedPool.priceInverse}</p>
			</div>
			{#if hasError}
				<p class="error-text">Enter a valid positive integer LP amount.</p>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.remove-liquidity-form {
		min-width: 28rem;
		max-width: 100%;
		box-sizing: border-box;
	}
	.remove-liquidity-form :global([data-part='root']) {
		width: 100%;
		min-width: 0;
	}
	.remove-liquidity-form :global([data-part='control']) {
		min-width: 100%;
	}
	.remove-liquidity-form :global([data-part='trigger']) {
		min-width: 100%;
		box-sizing: border-box;
	}
	.remove-liquidity-form :global([data-part='positioner']) {
		z-index: 9999 !important;
		min-width: var(--reference-width);
		box-sizing: border-box;
	}
	.remove-liquidity-form :global([data-part='content']) {
		max-height: 260px;
		overflow-y: auto;
		overflow-x: visible;
		min-width: 100%;
	}
	.remove-liquidity-form :global([data-part='item-text']) {
		overflow: visible;
		white-space: nowrap;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.label {
		font-size: 14px;
		color: var(--dash-text-muted);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: 'Nunito Sans', sans-serif;
	}
	.form-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.input-wrap {
		display: flex;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.25);
		border-radius: 12px;
		padding: 0.65rem 0.75rem;
		gap: 0.5rem;
	}
	.input-wrap input {
		flex: 1;
		background: none;
		border: none;
		color: var(--dash-text-primary);
		font-size: 16px;
		min-width: 0;
	}
	.input-wrap input:focus {
		outline: none;
	}
	.position-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.asset-card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.asset-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.balance {
		font-size: 12px;
		color: var(--dash-text-muted);
	}
	.asset-icon {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--dash-surface-alt);
	}
	.asset-icon.icon-b {
		background: var(--dash-accent-purple);
	}
	.rate-info {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 0.75rem 1rem;
		font-size: 14px;
		color: var(--dash-text-muted);
	}
	.error-text {
		color: var(--dash-accent-red);
		font-size: 11px;
	}
</style>
