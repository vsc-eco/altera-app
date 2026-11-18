<script lang="ts">
	// Always shown next to a deposit address. Vault generations rotate on a
	// schedule, so an address is only good for the deposit it was shown for:
	// after a rotation the old vault forwards late deposits for a while, then
	// retires and stops crediting them. A saved or automated address is the
	// only way to hit that, so the warning sits wherever an address is shown.
	//
	// The headline is the instruction; the reason is behind the (?), because
	// a reader who is mid-deposit needs the instruction, not the mechanism.
	import { Notice } from '$lib/ui';
</script>

<Notice
	tone="warn"
	title="Do not save this address."
	hint="Magi's deposit vaults rotate on a schedule, so this address changes. A late deposit to a retired address is not credited automatically and needs support to recover, so always copy the address shown on this screen, now."
>
	Send only to the address shown here, now.
</Notice>
