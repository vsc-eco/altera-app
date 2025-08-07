<script lang="ts">
	import { getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { Dot } from '@lucide/svelte';

	let {
		did,
		name,
		accounts,
		lastPaid,
		adjacent = false,
		detailed = true,
		warning
	}: {
		did: string;
		name?: string;
		accounts: string[];
		lastPaid: string;
		adjacent?: boolean;
		detailed?: boolean;
		warning?: string;
	} = $props();
	const username = $derived(getUsernameFromDid(did));
</script>

<div class="wrapper">
	<Avatar {did} large={!adjacent} />
	<!-- <InfoSegment
		label={name ?? username}
		display={detailed
			? [`${accounts.length} Address Available`, `Last paid ${lastPaid}`]
			: undefined}
	/> -->
	<div class="name-details">
		<span class="name">
			{name ?? username}
		</span>
		{#if detailed}
			<div class={['details', { adjacent: adjacent }]}>
				{#if !warning}
					<span class="available-addresses">{accounts.length} Address Available</span>
					{#if adjacent}
						<Dot />
					{/if}
					<span class="last-paid">
						Last paid
						{lastPaid}
					</span>
				{:else}
					<span class="warning">{warning}</span>
				{/if}
			</div>
		{/if}
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
		margin-top: 0;
	}
	.warning {
		color: var(--secondary-bg-mid);
	}
</style>
