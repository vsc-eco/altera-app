<script lang="ts">
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { getDisplayName } from './sendUtils';

	let {
		did,
		name,
		accounts,
		lastPaid
	}: {
		did: string;
		name?: string;
		accounts: string[];
		lastPaid: string;
	} = $props();
	const username = $derived(getUsernameFromDid(did));
</script>

<div class="wrapper">
	<Avatar {did} large />
	<div class="details">
		<span class="name">
			{name ?? username}
		</span>
		<span class="available-addresses">{accounts.length} Address Available</span>
		<span class="last-paid">
			Last paid
			{lastPaid}
		</span>
	</div>
</div>

<style>
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.details {
		display: flex;
		flex-direction: column;
	}
	.name {
		margin-bottom: 0.5rem;
	}
	.available-addresses {
		font-size: var(--text-sm);
		line-height: 1.2;
	}
	.last-paid {
		font-size: var(--text-sm);
		line-height: 1.2;
	}
</style>
