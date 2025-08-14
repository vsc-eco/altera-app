<script lang="ts">
	import { getDidFromUsername } from '$lib/getAccountName';
	import { type Contact } from '$lib/send/contacts/contacts';
	import { getDisplayName, SendTxDetails } from '$lib/send/sendUtils';
	import { CircleUser, Plus } from '@lucide/svelte';
	import ContactInfo from '../components/ContactInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import EditButton from '$lib/components/EditButton.svelte';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import { untrack } from 'svelte';

	let {
		basic = false,
		contact,
		edit
	}: { basic?: boolean; contact?: Contact; edit?: (isOpen?: boolean) => void } = $props();

	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
	let lastPaid = $state('Never');
	let isValidHive = $state(false);
	let loading = $state(false);
	$effect(() => {
		const newDid = toDid;
		untrack(() => {
			if ($SendTxDetails.toUsername === '') return;
			if (!contact) loading = true;
			getDisplayName(newDid).then((displayName) => {
				isValidHive = displayName !== null;
				loading = false;
			});
		});
	});

	let warningMsg = $derived(
		getDidFromUsername($SendTxDetails.toUsername).startsWith('hive:') && !isValidHive && !loading
			? 'Warning: This hive account does not exist. Payment to this address may result in loss of funds.'
			: undefined
	);

	const isPlaceholder = $derived(!(loading || $SendTxDetails.toUsername || contact));
</script>

<ClickableCard
	onclick={() => {
		if (edit) edit();
	}}
	disabled={basic}
>
	<div class={['name-card', { padded: !basic }]}>
		{#if loading}
			<span class={['loading', { large: !basic }]}>
				<WaveLoading size={32} />
			</span>
		{:else if contact}
			<ContactInfo
				did={$SendTxDetails.toUsername !== '' ? toDid : undefined}
				name={contact.label}
				icon={contact.image}
				accounts={contact.addresses}
				lastPaid={contact.lastPaid}
				size="large"
				showSelected
			/>
		{:else if $SendTxDetails.toUsername}
			<ContactInfo
				did={toDid}
				name={$SendTxDetails.toDisplayName}
				accounts={[{ address: $SendTxDetails.toUsername, label: 'Primary' }]}
				showSelected
				{lastPaid}
				warning={warningMsg}
				size={basic ? 'medium' : 'large'}
			/>
		{:else}
			<span class="user-icon-placeholder">
				{#if basic}
					<CircleUser size="40" />
				{:else}
					<CircleUser size="56" strokeWidth="4" absoluteStrokeWidth={true} />
				{/if}
				Select a Recipient
			</span>
		{/if}
		{#if edit}
			<span class="more">
				{#if isPlaceholder}
					<PillButton
						onclick={(e) => {
							e.stopPropagation();
							edit(true);
						}}
					>
						<Plus /> Add Contact
					</PillButton>
				{:else}
					<EditButton
						onclick={(e) => {
							e.stopPropagation();
							edit(true);
						}}
					/>
				{/if}
			</span>
		{/if}
	</div>
</ClickableCard>

<style lang="scss">
	.user-icon-placeholder {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.name-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		&.padded {
			padding: 0.5rem;
		}
	}
	.more {
		margin-left: auto;
	}
	.loading {
		display: flex;
		align-items: center;
		height: 40px;
		&.large {
			height: 56px;
		}
	}
</style>
