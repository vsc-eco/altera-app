<script lang="ts">
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillBtn from '$lib/PillButton.svelte';
	import { sHbdAprStore } from '$lib/stores/aprStore';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { Coin } from '$lib/sendswap/utils/sendOptions';

	type Props = {
		onStake: () => void;
	};

	let { onStake }: Props = $props();

	// HBD savings balance in whole HBD (1 HBD ≈ $1 USD)
	const hbdSavings = $derived(
		$accountBalance.bal.hbd_savings / 10 ** Coin.hbd.decimalPlaces
	);

	const aprLabel = $derived($sHbdAprStore !== null ? `${$sHbdAprStore}%` : '—');

	// Estimated earnings based on current balance × APR. HBD ≈ $1 so these
	// double as approximate USD values. Shown as '—' while APR is loading or
	// if the user has no sHBD balance.
	const todayLabel = $derived.by(() => {
		if ($sHbdAprStore === null || hbdSavings === 0) return '—';
		const daily = (hbdSavings * ($sHbdAprStore / 100)) / 365;
		return `$${daily.toFixed(3)}`;
	});

	const monthLabel = $derived.by(() => {
		if ($sHbdAprStore === null || hbdSavings === 0) return '—';
		const monthly = (hbdSavings * ($sHbdAprStore / 100)) / 12;
		return `$${monthly.toFixed(2)}`;
	});
</script>

<div class="staking-card dashboard-card">
	<div class="staking-header">
		<span class="status-dot"></span>
		<h5>Staking earnings (sHBD)</h5>
		<div class="staking-action">
			<PillBtn
				theme="primary"
				styleType="outline"
				style="--height: 1.75rem; font-size: 0.75rem; padding: 0 0.6rem;"
				onclick={() => {
					onStake();
				}}
			>
				Staking
			</PillBtn>
		</div>
	</div>
	<div class="staking-details">
		<div class="staking-stat">
			<span class="label">Today:</span>
			<span class="value">{todayLabel}</span>
		</div>
		<div class="staking-stat">
			<span class="label">This month:</span>
			<span class="value">{monthLabel}</span>
		</div>
		<div class="staking-stat">
			<span class="label">Earn APR:</span>
			<span class="value">{aprLabel}</span>
		</div>
		<div class="staking-stat">
			<span class="label">Currently Staked:</span>
			<span class="value">{new CoinAmount($accountBalance.bal.hbd_savings, Coin.hbd, true)}</span>
		</div>
		<div class="staking-stat">
			<span class="label">Next payout in:</span>
			<span class="value">—</span>
		</div>
	</div>
</div>

<style>
	.staking-card {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.staking-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--dash-accent-green);
		flex-shrink: 0;
	}
	.staking-card h5 {
		color: var(--dash-text-primary);
		margin: 0 !important;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.staking-details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		align-items: flex-start;
	}
	.staking-stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1 1 auto;
		min-width: max-content;
	}
	.staking-stat .label {
		color: var(--dash-text-muted);
		font-size: 0.65rem;
		font-weight: 500;
		white-space: nowrap;
	}
	.staking-stat .value {
		color: var(--dash-text-primary);
		font-weight: 700;
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.staking-action {
		margin-left: auto;
		flex-shrink: 0;
	}
</style>
