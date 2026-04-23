<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';

	let isHovered = $state(false);
	let {
		otherAccount,
		memo
	}: { otherAccount: string; memo?: string | undefined } = $props();
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	<span class="to-from">
		<span class="pfp">
			<Avatar did={otherAccount} fallback="" size={"small"}></Avatar>
		</span>
		<span class="toFrom">
			<BasicCopy value={getUsernameFromDid(otherAccount)} show={isHovered}>
				{getUsernameFromDid(otherAccount)}
			</BasicCopy>
		</span>
		{#if memo}
			<span class="memo">
				"{memo}"
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
		grid-template-areas: 'pfp toFrom memo';
		grid-template-columns: auto minmax(0, 1fr) minmax(0, auto);
		justify-content: left;
		column-gap: 0.25rem;
		align-items: center;
		align-content: center;
		overflow: hidden;
		/* height: 4.5rem; */
	}

	.pfp {
		grid-area: pfp;
	}
	.memo {
		grid-area: memo;
	}
	.memo {
		/* align-self: baseline; */
		font-weight: 400;
		color: var(--dash-text-secondary);
		font-size: var(--text-sm);
		margin-left: 0.5rem;
		line-height: 1.5;
	}

	.to-from > .memo {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		display: flex;
		align-items: center;
		height: max-content;
	}
	.toFrom {
		grid-area: toFrom;
		display: flex;
		align-items: center;
		overflow: hidden;
		min-width: 0;
	}
	/* BasicCopy wrapper — allow it to shrink and fill available space */
	.toFrom :global(> span) {
		min-width: 0;
		overflow: hidden;
		flex: 1;
		display: flex;
		align-items: center;
	}
	/* The actual text node inside BasicCopy — this is where ellipsis must live */
	.toFrom :global(> span > .content) {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		min-width: 0;
	}
	@media screen and (max-width: 450px) {
		.to-from {
			grid-template-areas: 'pfp toFrom';
			grid-template-columns: auto minmax(0, 1fr);
		}
		.memo {
			display: none !important;
		}
	}
</style>
