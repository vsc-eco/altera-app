<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';

	// Always shown next to a deposit address. Vault generations rotate on a
	// schedule, so an address is only good for the deposit it was shown for:
	// after a rotation the old vault forwards late deposits for a while, then
	// retires and stops crediting them. A saved or automated address is the
	// only way to hit that, so the warning sits wherever an address is shown.
</script>

<div class="deposit-address-notice" role="note">
	<span class="icon"><CircleAlert size={18} /></span>
	<span>
		<strong>Do not save this address.</strong> Vaults rotate on a schedule, so the address changes. Only
		send to the address shown here, now. A saved address can stop being credited.
	</span>
</div>

<style lang="scss">
	.deposit-address-notice {
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
