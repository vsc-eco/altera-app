<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';
	import type { OutputRef } from './failureReason';

	type Props = {
		title: string;
		status: string;
		/** Passed through so a `failed` badge can explain itself — see
		 *  StatusBadge. */
		tx?: { id: string; output?: readonly (OutputRef | null | undefined)[] | null } | null;
		opIndex?: number;
	};
	let { title, status, tx = null, opIndex = 0 }: Props = $props();
</script>

<div class="popup-title-row">
	<h2>{title}</h2>
	<StatusBadge {status} {tx} {opIndex} compact />
</div>

<style>
	.popup-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
	}
</style>
