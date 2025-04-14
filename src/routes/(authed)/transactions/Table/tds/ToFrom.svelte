<script lang="ts">
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';

	let { otherAccount, memo }: { otherAccount: string; memo: string | undefined } = $props();
</script>

<td>
	<span class="to-from">
		<span class="pfp">
			<Avatar did={otherAccount} fallback=""></Avatar>
		</span>
		<span class="toFrom">
			{getAccountNameFromDid(otherAccount)}
		</span>
		{#if memo}
			<span class="m-label">memo:</span>
			<span class="memo">
				{memo}
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
		grid-template:
			'pfp     toFrom'
			'm-label memo';
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
	.m-label {
		grid-area: m-label;
	}
	.memo,
	.m-label {
		align-self: baseline;
		font-weight: 400;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
	}

	.toFrom {
		grid-area: toFrom;
	}
	.to-from > .toFrom,
	.to-from > .memo {
		text-overflow: ellipsis;
		overflow-x: hidden;
		height: 1.2rem;
		white-space: nowrap;
	}
</style>
