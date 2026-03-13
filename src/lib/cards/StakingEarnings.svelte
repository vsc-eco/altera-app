<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { LockKeyhole } from '@lucide/svelte';

	type Props = {
		onStake: () => void;
	};

	let { onStake }: Props = $props();
</script>

<Card>
	<div class="staking-card">
		<h5>Staking earnings (sHBD)</h5>
		<div class="staking-details">
			<div class="staking-stat">
				<span class="label">Today:</span>
				<span class="value">$0.18</span>
			</div>
			<div class="staking-stat">
				<span class="label">This month:</span>
				<span class="value">$7.42</span>
			</div>
			<div class="staking-stat">
				<span class="label">Earn APR</span>
				<span class="value">15%</span>
			</div>
			<div class="staking-stat">
				<span class="label">Next payout in</span>
				<span class="value">16h 30m</span>
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
</Card>

<style>
	.staking-card {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.staking-card h5 {
		color: var(--primary-text);
	}
	.staking-details {
		display: flex;
		flex-wrap: nowrap;
		gap: 1.5rem;
		font-size: var(--text-sm);
		align-items: center;
		justify-content: space-between;
	}
	.staking-stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: max-content;
	}
	.staking-stat .label {
		color: var(--neutral-fg-mid);
	}
	.staking-stat .value {
		color: var(--primary-text);
		font-weight: 600;
	}
	.staking-action {
		margin-left: auto;
	}
	.staking-action :global(button),
	.staking-action :global(a) {
		--height: 48px;
		height: 48px;
		min-height: 48px;
		min-width: 166px;
		padding: 14px 9px;
		gap: 10px;
		border-radius: 40px;
		border-width: 1px;
		box-sizing: border-box;
	}
</style>

