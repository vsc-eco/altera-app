<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { NotebookPen } from '@lucide/svelte';
	import StatusBadge from '../StatusBadge.svelte';

	const TRUNCATE_AT = 15;

	let isHovered = $state(false);
	let { address, status }: { address: string; status?: string } = $props();

	const isLong = $derived(address.length > TRUNCATE_AT);
	const displayText = $derived(isLong ? address.slice(0, TRUNCATE_AT) + '…' : address);
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	<span class="to-from">
		<span class="pfp">
			<NotebookPen size="16" />
		</span>
		<span class="contract-address" class:small={isLong}>
			<BasicCopy value={address} show={isHovered}>
				{displayText}
			</BasicCopy>
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
	}
	@media screen and (max-width: 450px) {
		.to-from {
			grid-template: 'pfp toFrom status';
		}
	}
	.pfp {
		grid-area: pfp;
		width: 1.5rem;
		height: 1.5rem;
		background-color: var(--dash-surface-alt);
		border-radius: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--dash-text-secondary);
	}
	.status {
		grid-area: status;
	}

	.to-from > .contract-address,
	.contract-address {
		grid-area: toFrom;
	}
	.contract-address.small {
		font-size: 0.75rem;
	}
</style>
