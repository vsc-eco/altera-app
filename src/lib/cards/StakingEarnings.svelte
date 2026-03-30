<script lang="ts">
	type Props = {
		onStake: () => void;
	};
	let { onStake }: Props = $props();
</script>

<div class="staking-card">
	<div class="staking-header">
		<span class="status-dot"></span>
		<h5>Staking earnings (sHBD)</h5>
	</div>
	<div class="staking-details">
		<div class="staking-stat">
			<span class="label">Today:</span>
			<span class="value down">$0.18 <span class="arrow">&#9660;</span></span>
		</div>
		<div class="staking-stat">
			<span class="label">This month:</span>
			<span class="value up">$7.42 <span class="arrow">&#9650;</span></span>
		</div>
		<div class="staking-stat">
			<span class="label">Earn APR:</span>
			<span class="value">15%</span>
		</div>
		<div class="staking-stat">
			<span class="label">Next payout in:</span>
			<span class="value">16h 30m</span>
		</div>
		<div class="staking-action">
			<button class="staking-btn" onclick={onStake}>Staking</button>
		</div>
	</div>
</div>

<style>
	.staking-card {
		background-color: var(--dash-card-bg);
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
		gap: 1.5rem;
		align-items: flex-end;
	}
	.staking-stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.staking-stat .label {
		color: var(--dash-text-muted);
		font-size: 0.7rem;
		font-weight: 500;
	}
	.staking-stat .value {
		color: var(--dash-text-primary);
		font-weight: 700;
		font-size: 1.05rem;
	}
	.staking-stat .value.up {
		color: var(--dash-accent-green);
	}
	.staking-stat .value.down {
		color: var(--dash-accent-red);
	}
	.staking-stat .value .arrow {
		font-size: 0.55rem;
	}
	.staking-action {
		margin-left: auto;
	}
	.staking-btn {
		height: 40px;
		min-width: 110px;
		padding: 0 1.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--dash-btn-outline-border);
		background: transparent;
		color: var(--dash-text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s;
	}
	.staking-btn:hover {
		border-color: var(--dash-accent-purple);
		background-color: var(--dash-accent-purple-light);
	}
</style>
