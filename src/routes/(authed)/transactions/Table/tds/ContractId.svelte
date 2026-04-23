<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { NotebookPen } from '@lucide/svelte';

	const LONG_THRESHOLD = 16;

	let isHovered = $state(false);
	let { address }: { address: string } = $props();

	const isLong = $derived(address.length > LONG_THRESHOLD);
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	<span class="to-from">
		<span class="pfp">
			<NotebookPen size="16" />
		</span>
		<span class="contract-address" class:small={isLong}>
			<BasicCopy value={address} show={isHovered}>
				{address}
			</BasicCopy>
		</span>
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
		grid-template-areas: 'pfp toFrom';
		grid-template-columns: auto minmax(0, 1fr);
		justify-content: left;
		column-gap: 0.25rem;
		align-items: center;
		align-content: center;
		overflow: hidden;
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

	.to-from > .contract-address,
	.contract-address {
		grid-area: toFrom;
		display: flex;
		align-items: center;
		overflow: hidden;
		min-width: 0;
	}
	.contract-address.small {
		font-size: 0.75rem;
	}
	/* BasicCopy wrapper */
	.contract-address :global(> span) {
		min-width: 0;
		overflow: hidden;
		flex: 1;
		display: flex;
		align-items: center;
	}
	/* Text node inside BasicCopy */
	.contract-address :global(> span > .content) {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		min-width: 0;
	}
</style>
