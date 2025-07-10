<script lang="ts">
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { Dot } from '@lucide/svelte';
	import { getDisplayName } from '../sendUtils';

	let {
		did,
		name,
		accounts,
		lastPaid,
		adjacent = false
	}: {
		did: string;
		name?: string;
		accounts: string[];
		lastPaid: string;
		adjacent?: boolean;
	} = $props();
	const username = $derived(getUsernameFromDid(did));
</script>

<div class="wrapper">
	<Avatar {did} large={!adjacent} />
	<div class="name-details">
		<span class="name">
			{name ?? username}
		</span>
		<div class={['details', { adjacent: adjacent }]}>
			<span class="available-addresses">{accounts.length} Address Available</span>
			{#if adjacent}
				<Dot />
			{/if}
			<span class="last-paid">
				Last paid
				{lastPaid}
			</span>
		</div>
	</div>
</div>

<style>
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.name-details {
		display: flex;
		flex-direction: column;
	}
	.details {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		color: var(--neutral-fg-mid);
	}
	.details.adjacent {
		flex-direction: row;
		align-items: center;
		margin-top: 0.25rem;
	}
</style>
