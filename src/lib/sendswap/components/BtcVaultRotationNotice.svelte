<script lang="ts">
	import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
	import { fetchVaultRotationStatus } from '$lib/magiTransactions/bitcoin/vaultRotation';
	import { Notice } from '$lib/ui';

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
	<Notice
		tone="warn"
		title="BTC withdrawals are slower right now."
		hint="The Bitcoin vault is rotating: funds are being swept from one vault generation to the next, and a withdrawal has to wait for that sweep. Expect up to about an hour on chain. Your balance is not affected — only the payout is slower than usual."
	>
		A withdrawal can take up to about an hour to arrive.
	</Notice>
{/if}
