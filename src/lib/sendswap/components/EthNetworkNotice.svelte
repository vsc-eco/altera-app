<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { ETH_NETWORK } from '$lib/sendswap/utils/ethNetworkCopy';

	// Shown on the ETH/USDC deposit page: the bridge's address is the same on
	// every EVM chain, so ETH or USDC sent to it from another network lands where
	// the bridge never looks (ethNetworkCopy.ts). Styled like DepositAddressNotice.
</script>

<div class="eth-network-notice" role="note">
	<span class="icon"><CircleAlert size={18} /></span>
	<span>
		<strong>{ETH_NETWORK} only.</strong> ETH or USDC sent from BSC, Base, Arbitrum or any other network
		is lost.
	</span>
</div>

<style lang="scss">
	.eth-network-notice {
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
