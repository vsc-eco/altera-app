<script lang="ts">
	import PillBtn from '$lib/PillButton.svelte';

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
		<div class="staking-action">
			<PillBtn
				theme="primary"
				styleType="outline"
				onclick={() => {
					onStake();
				}}
			>
				Staking
			</PillBtn>
		</div>
	</div>
</div>

<style>
	.staking-card {
		background-color: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 0.75rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.staking-details {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		font-size: var(--text-sm);
		align-items: center;
	}
	.staking-stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: max-content;
	}
	.staking-stat .label {
		color: var(--dash-text-muted);
		font-size: 0.75rem;
	}
	.staking-stat .value {
		color: var(--dash-text-primary);
		font-weight: 600;
		font-size: 0.95rem;
	}
	.staking-stat .value.up {
		color: var(--dash-accent-green);
	}
	.staking-stat .value.down {
		color: var(--dash-accent-red);
	}
	.staking-stat .value .arrow {
		font-size: 0.6rem;
	}
	.staking-action {
		margin-left: auto;
	}
	.staking-action :global(button),
	.staking-action :global(a) {
		--height: 40px;
		height: 40px;
		min-height: 40px;
		min-width: 120px;
		padding: 10px 16px;
		gap: 8px;
		border-radius: 2rem;
		border-width: 1px;
		box-sizing: border-box;
		font-size: 0.85rem;
	}
</style>

