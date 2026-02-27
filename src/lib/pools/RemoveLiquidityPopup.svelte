<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';

let {
	open = $bindable(false),
	toggle = $bindable(),
	pools
}: { open?: boolean; toggle?: (o?: boolean) => void; pools: PoolRow[] } = $props();
	let dialogToggle = $state<(o?: boolean) => void>(() => {});

	$effect(() => {
		if (open) dialogToggle(true);
		else selectedPool = null;
	});

	let selectedPool = $state<PoolRow | null>(null);
	let removePercent = $state('100');

	const poolOptions = $derived(
		pools
			.filter((p) => p.pair === 'SWAP.HIVE:SWAP.HBD')
			.map((p) => ({ value: p.id, label: p.pair }))
	);

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		selectedPool = pools.find((p) => p.id === id) ?? null;
		removePercent = '100';
	}

	function setMaxPercent() {
		removePercent = '100';
	}
</script>

<Dialog bind:open bind:toggle={dialogToggle}>
	{#snippet title()}
		Remove Liquidity
	{/snippet}
	{#snippet content()}
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
						<label for="remove-liq-percent" class="label">Amount to remove</label>
						<div class="input-wrap">
							<input
								id="remove-liq-percent"
								type="text"
								bind:value={removePercent}
								placeholder="0"
								inputmode="decimal"
								aria-label="Percentage to remove"
							/>
							<span class="suffix">%</span>
							<button class="max-btn" type="button" onclick={setMaxPercent}>
								Max
							</button>
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

					<button type="button" class="remove-liquidity-btn">Remove Liquidity</button>
				</div>
			{/if}
		</div>
	{/snippet}
</Dialog>

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
		min-width: 0;
	}

	.input-wrap input:focus {
		outline: none;
	}

	.suffix {
		color: var(--neutral-fg-mid);
		font-size: 14px;
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

	.position-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.asset-card {
		background: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.9rem;
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
		color: var(--neutral-fg-mid);
	}

	.asset-icon {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--primary-bg-mid);
	}

	.asset-icon.icon-b {
		background: var(--primary-bg-accent);
	}

	.rate-info {
		background: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent);
		border-radius: 0.8rem;
		padding: 0.75rem 1rem;
		font-size: 14px;
		color: var(--neutral-fg-mid);
	}

	.remove-liquidity-btn {
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

	.remove-liquidity-btn:hover {
		background: var(--primary-bg-accent);
	}
</style>
