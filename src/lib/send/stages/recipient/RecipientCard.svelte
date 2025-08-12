<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import { getDidFromUsername } from '$lib/getAccountName';
	import { getContacts, searchContactsForAddress, type Contact } from '$lib/send/contacts/contacts';
	import { getDisplayName, SendTxDetails } from '$lib/send/sendUtils';
	import { CircleUser, MapPin } from '@lucide/svelte';
	import ContactInfo from '../components/ContactInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';

	let { contact, edit }: { contact?: Contact; edit?: () => void } = $props();

	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
	let lastPaid = $state('Never');
	let isValidHive = $state(false);
	$effect(() => {
		getDisplayName(toDid).then((displayName) => {
			isValidHive = displayName !== null;
		});
	});

	let warningMsg = $derived(
		getDidFromUsername($SendTxDetails.toUsername).startsWith('hive:') && !isValidHive
			? 'Warning: This hive account does not exist. Payment to this address may result in loss of funds.'
			: undefined
	);
</script>

<Card>
	<div class="name-card">
		{#if $SendTxDetails.toUsername}
			<ContactInfo
				did={toDid}
				name={contact?.label ?? $SendTxDetails.toDisplayName}
				icon={contact?.image}
				accounts={contact ? contact?.addresses : [{ address: $SendTxDetails.toUsername }]}
				showSelected
				{lastPaid}
				warning={warningMsg}
				size="large"
			/>
		{:else if contact}
			<ContactInfo
				name={contact.label}
				icon={contact.image}
				accounts={contact.addresses}
				lastPaid={contact.lastPaid}
				size="large"
			/>
		{:else}
			<span class="user-icon-placeholder">
				<CircleUser size="56" strokeWidth="4" absoluteStrokeWidth={true} />
				Select a Recipient
			</span>
		{/if}
		{#if edit}
			<span class="more">
				<PillButton onclick={edit} styleType="text-subtle"><span>Edit</span></PillButton>
			</span>
		{/if}
	</div>
	{#if $SendTxDetails.toUsername}
		<div class="address">
			<BasicCopy value={$SendTxDetails.toUsername} clickAnywhere>
				<MapPin />
				{$SendTxDetails.toUsername}
			</BasicCopy>
		</div>
	{/if}
</Card>

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
		padding: 0.5rem;
	}
	.more {
		margin-left: auto;
		span {
			color: var(--accent-fg-mid);
			font-size: var(--text-sm);
		}
	}
	.address {
		padding: 0.5rem 0;
		padding-left: 1.5rem;
	}
</style>
