<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow, MyPoolRow } from '$lib/pools/poolsData';
	import { removeLiquidityDraftStore } from '$lib/pools/removeLiquidityStore';
	import { Coin } from '$lib/sendswap/utils/sendOptions';

	function getCoinIcon(symbol: string): string | undefined {
		const s = symbol.toUpperCase();
		if (s === 'BTC') return Coin.btc.icon;
		if (s === 'HBD') return Coin.hbd.icon;
		if (s === 'HIVE') return Coin.hive.icon;
		return undefined;
	}

	let {
		editStage,
		pools = [],
		myPools = []
	}: {
		editStage: (complete: boolean) => void;
		pools: PoolRow[];
		myPools?: MyPoolRow[];
	} = $props();

	let selectedPool = $state<PoolRow | null>(null);
	let lpAmount = $state('');

	const poolOptions = $derived(pools.map((p) => ({ value: p.id, label: p.pair })));

	const selectedMyPool = $derived.by(() => {
		if (!selectedPool) return null;
		const poolId = selectedPool.contractId;
		return myPools.find((mp) => mp.contractId === poolId) ?? null;
	});
	const userLpBalance = $derived(selectedMyPool?.lpBalance ?? 0);

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		selectedPool = pools.find((p) => p.id === id) ?? null;
		lpAmount = '';
	}

	function onLpAmountInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		lpAmount = value.replace(/[^\d]/g, '');
	}

	function setMax() {
		if (userLpBalance > 0) lpAmount = String(userLpBalance);
	}

	const parsedLpAmount = $derived(lpAmount ? Number(lpAmount) : 0);
	const exceedsBalance = $derived(userLpBalance > 0 && parsedLpAmount > userLpBalance);
	const hasError = $derived(
		!Number.isInteger(parsedLpAmount) || parsedLpAmount <= 0 || exceedsBalance
	);

	// Estimated asset output: user's pro-rata share of the pool reserves
	// for the LP amount being burned. Uses the same reserve0Raw/reserve1Raw/
	// totalLpRaw the My Liquidity table reads from.
	function formatEstimate(value: number, decimals: number): string {
		if (!Number.isFinite(value) || value <= 0) return '0';
		return value.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: decimals
		});
	}
	const estimatedOut0 = $derived.by(() => {
		if (!selectedPool || parsedLpAmount <= 0 || selectedPool.totalLpRaw <= 0) return 0;
		return (
			(selectedPool.reserve0Raw * parsedLpAmount) /
			selectedPool.totalLpRaw /
			10 ** selectedPool.decimals0
		);
	});
	const estimatedOut1 = $derived.by(() => {
		if (!selectedPool || parsedLpAmount <= 0 || selectedPool.totalLpRaw <= 0) return 0;
		return (
			(selectedPool.reserve1Raw * parsedLpAmount) /
			selectedPool.totalLpRaw /
			10 ** selectedPool.decimals1
		);
	});

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
					<button
						type="button"
						class="max-btn"
						onclick={setMax}
						disabled={userLpBalance <= 0}
					>
						max
					</button>
				</div>
				<span class="balance-subtitle">
					Balance: {userLpBalance.toLocaleString()} LP
				</span>
			</div>

			<div class="position-info">
				<span class="label">You will receive (estimated)</span>
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">
							{#if getCoinIcon(selectedPool.pairSymbols[0])}
								<img class="asset-icon" src={getCoinIcon(selectedPool.pairSymbols[0])} alt={selectedPool.pairSymbols[0]} />
							{:else}
								<span class="asset-icon icon-a"></span>
							{/if}
							{selectedPool.pairSymbols[0]}
						</div>
						<span class="balance"
							>~{formatEstimate(estimatedOut0, selectedPool.decimals0)}
							{selectedPool.pairSymbols[0]}</span
						>
					</div>
				</div>
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">
							{#if getCoinIcon(selectedPool.pairSymbols[1])}
								<img class="asset-icon" src={getCoinIcon(selectedPool.pairSymbols[1])} alt={selectedPool.pairSymbols[1]} />
							{:else}
								<span class="asset-icon icon-b"></span>
							{/if}
							{selectedPool.pairSymbols[1]}
						</div>
						<span class="balance"
							>~{formatEstimate(estimatedOut1, selectedPool.decimals1)}
							{selectedPool.pairSymbols[1]}</span
						>
					</div>
				</div>
			</div>

			<div class="rate-info">
				<p>1 {selectedPool.pairSymbols[0]} = {selectedPool.priceRatio}</p>
				<p>1 {selectedPool.pairSymbols[1]} = {selectedPool.priceInverse}</p>
			</div>
			{#if exceedsBalance}
				<p class="error-text">Amount exceeds your LP balance ({userLpBalance.toLocaleString()}).</p>
			{:else if hasError}
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
		min-height: 18rem;
		font-family: 'Nunito Sans', sans-serif;
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
		position: relative;
		z-index: 10;
	}
	.label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--dash-text-muted);
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
		border: 1px solid var(--dash-input-border);
		background-color: var(--dash-swap-field-bg);
		border-radius: 16px;
		padding: 0.75rem;
		gap: 0.5rem;
	}
	.input-wrap input {
		flex: 1;
		background: none;
		border: none;
		color: var(--dash-text-primary);
		font-size: 1.25rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		min-width: 0;
	}
	.input-wrap input:focus {
		outline: none;
	}
	.max-btn {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		color: var(--dash-text-primary);
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		font-family: 'Nunito Sans', sans-serif;
	}
	.max-btn:hover:not(:disabled) {
		background: var(--dash-surface-alt);
	}
	.max-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.balance-subtitle {
		font-size: 0.75rem;
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
		margin-top: 0.25rem;
	}
	.position-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.asset-card {
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 16px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.asset-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.balance {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
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
