<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';

	let isHovered = $state(false);
	let {
		otherAccount,
		memo,
		status
	}: { otherAccount: string; memo?: string | undefined; status?: string } = $props();
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	<span class="to-from">
		<span class="pfp">
			<Avatar did={otherAccount} fallback=""></Avatar>
		</span>
		<span class="toFrom">
			<BasicCopy value={getUsernameFromDid(otherAccount)} show={isHovered}>
				{getAccountNameFromDid(otherAccount)}
			</BasicCopy>
		</span>
		{#if memo}
			<span class="memo">
				"{memo}"
			</span>
		{/if}
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

	.pfp {
		grid-area: pfp;
	}
	.memo {
		grid-area: memo;
	}
	.status {
		grid-area: status;
	}
	.memo {
		/* align-self: baseline; */
		font-weight: 400;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		margin-left: 0.5rem;
		line-height: 1.5;
	}

	.to-from > .toFrom,
	.to-from > .memo {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		display: flex;
		align-items: center;
		height: max-content;
	}
	.toFrom {
		grid-area: toFrom;
	}
	@media screen and (max-width: 450px) {
		.to-from {
			grid-template: 'pfp toFrom status';
		}
		.memo {
			display: none !important;
		}
	}
</style>
