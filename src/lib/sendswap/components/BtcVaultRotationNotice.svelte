<script lang="ts">
	import { Clock } from '@lucide/svelte';
	import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
	import { fetchVaultRotationStatus } from '$lib/magiTransactions/bitcoin/vaultRotation';

	// Self-fetching, fail-safe heads-up shown only while the BTC vault is
	// mid-rotation — the window in which an `unmap` can take ~an hour to settle
	// on-chain while UTXOs are swept between vault generations. Balances, pools
	// and the HBD side are untouched by a rotation (see vaultRotation.ts), so
	// this is purely a "withdrawals are slower right now" notice. It renders
	// nothing otherwise, which also makes it inert on the pre-v2 single-vault
	// contract (the vault keys are absent → decoded as "not rotating").
	let show = $state(false);

	$effect(() => {
		let cancelled = false;
		fetchVaultRotationStatus(BTC_MAPPING_CONTRACT_ID).then((status) => {
			if (!cancelled) show = status.rotating || status.sweeping;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if show}
	<div class="vault-rotation-notice" role="status">
		<span class="icon"><Clock size={18} /></span>
		<span>
			<strong>BTC vault is rotating right now.</strong> A withdrawal can take up to about an hour
			to arrive on-chain while funds move between vaults. Your balance is safe — only the
			on-chain payout is slower than usual.
		</span>
	</div>
{/if}

<style lang="scss">
	.vault-rotation-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--dash-warning, #f59e0b);
		background: rgba(245, 158, 11, 0.13);
		color: var(--dash-text-primary);
		border-radius: 12px;
		font-size: var(--text-sm);
		line-height: 1.4;
		.icon {
			color: var(--dash-warning, #f59e0b);
			flex-shrink: 0;
			display: flex;
			margin-top: 0.1rem;
		}
		strong {
			font-weight: 700;
		}
	}
</style>
