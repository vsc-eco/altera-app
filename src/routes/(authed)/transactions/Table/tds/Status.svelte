<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';
	import type { OutputRef } from '../tr/failureReason';

	let {
		status,
		tx = null,
		opIndex = 0
	}: {
		status: string;
		/** Passed through so a `failed` badge can explain itself — see
		 *  StatusBadge. */
		tx?: { id: string; output?: readonly (OutputRef | null | undefined)[] | null } | null;
		opIndex?: number;
	} = $props();
</script>

<td>
	<StatusBadge {status} {tx} {opIndex} />
</td>

<style>
	td {
		justify-content: center;
	}
</style>
