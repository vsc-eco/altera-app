<script lang="ts">
	import { BTC_SENDER_REFUNDS_ACTIVE } from '$lib/constants';

	// A swap paid with Bitcoin that cannot complete goes back to the address that
	// sent the BTC, which the BTC mapping contract proves from the transaction
	// that funded it. It keeps about a month of Bitcoin blocks, so coins received
	// earlier (and an exchange's withdrawal) cannot be traced to their sender.
</script>

{#if BTC_SENDER_REFUNDS_ACTIVE}
	<p class="btc-sender-notice">
		Send from your own Bitcoin wallet, using coins it received within the last month. If the swap
		cannot complete, the BTC goes back to the address that sent it. Coins sent from an exchange, or
		received more than about a month ago, cannot be traced to their sender and wait for a manual
		refund.
	</p>
{/if}

<style lang="scss">
	.btc-sender-notice {
		color: var(--dash-text-secondary);
		font-size: 0.8rem;
		line-height: 1.4;
		margin: 0.25rem 0;
	}
</style>
