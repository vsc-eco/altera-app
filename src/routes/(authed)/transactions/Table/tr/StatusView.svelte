<script lang="ts">
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { ArrowDown } from '@lucide/svelte';
	import moment from 'moment';

	let {
		from,
		to,
		memo,
		first_seen
	}: { from: string; to: string; memo: string | undefined; first_seen: string } = $props();
	// TODO: support additional status once we have the graphQL endpoint to query
</script>

<div>
	<div class="transfer">
		<span class="from-avatar">
			<Avatar did={from}></Avatar>
		</span>
		<div class="from">
			From
			{getAccountNameFromDid(from)}
		</div>
		<div class="from-ts ts">{moment(first_seen).format('MMM DD [at] h:mmA')}</div>
		<ArrowDown />

		<span class="to-avatar">
			<Avatar did={to}></Avatar>
		</span>
		<span class="to">
			To
			{getAccountNameFromDid(to)}
		</span>
		<div class="to-ts ts">{moment(first_seen).format('MMM DD [at] h:mmA')}</div>
	</div>
</div>

<style>
	.transfer :global(svg) {
		grid-area: arrow;
		justify-self: center;
	}
	.transfer .from {
		grid-area: from;
		display: flex;
		align-items: center;
	}
	.transfer .to {
		grid-area: to;
		display: flex;
		align-items: center;
	}
	.from-avatar {
		grid-area: from-avatar;
	}
	.to-avatar {
		grid-area: to-avatar;
	}
	.from-ts {
		grid-area: from-ts;
	}
	.to-ts {
		grid-area: to-ts;
	}
	.ts {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	.transfer {
		margin-top: 0.5rem;
		display: grid;
		max-width: max-content;
		grid-template-areas:
			'from-avatar from'
			'from-avatar from-ts'
			'arrow .'
			'to-avatar to'
			'to-avatar to-ts';
		align-items: center;
		gap: 0.25rem;
	}
</style>
