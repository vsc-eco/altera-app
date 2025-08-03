<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { NotebookPen } from '@lucide/svelte';
	import StatusBadge from '../StatusBadge.svelte';

	let isHovered = $state(false);
	let { address, status }: { address: string; status?: string } = $props();
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	<span class="to-from">
		<span class="pfp">
			<NotebookPen size="24" />
		</span>
		<span class="contract-address">
			<BasicCopy value={address} show={isHovered} />
		</span>
		{#if status && status != 'CONFIRMED'}
			<span class="status">
				<StatusBadge {status} />
			</span>
		{/if}
	</span>
</td>

<style>
	td {
		padding-top: 0 !important;
		padding-bottom: 0 !important;
	}
	.to-from {
		width: 100%;
		display: grid;
		grid-template: 'pfp toFrom memo status';
		justify-content: left;
		column-gap: 0.25rem;
		align-items: center;
		align-content: center;
		height: 4.5rem;
	}
	@media screen and (max-width: 450px) {
		.to-from {
			grid-template: 'pfp toFrom status';
		}
	}
	.pfp {
		grid-area: pfp;
		width: 2.5rem;
		height: 2.5rem;
		background-color: var(--neutral-bg-accent);
		border-radius: 100%;
		text-align: center;
		align-content: center;
	}
	.status {
		grid-area: status;
	}

	.to-from > .contract-address,
	.contract-address {
		grid-area: toFrom;
	}
</style>
