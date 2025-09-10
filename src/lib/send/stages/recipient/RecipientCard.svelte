<script lang="ts">
	import { getAccountNameFromAddress, getDidFromUsername } from '$lib/getAccountName';
	import { type Contact } from '$lib/send/contacts/contacts';
	import {
		getLastPaidContact,
		momentToLastPaidString,
		SendTxDetails,
		validateAddress
	} from '$lib/send/sendUtils';
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
	let lastPaid: string | undefined = $state();
	let isValid = $state(false);
	let loading = $state(false);
	$effect(() => {
		const addr = $SendTxDetails.toUsername;
		untrack(() => {
			if (!addr) return;
			if (!contact) loading = true;
			validateAddress(addr).then((result) => {
				isValid = result.success;
				if (result.success) {
					const newDisplayName = contact
						? contact.label
						: (result.displayName ?? getAccountNameFromAddress(addr));
					if ($SendTxDetails.toDisplayName !== newDisplayName)
						$SendTxDetails.toDisplayName = newDisplayName;
				} else {
					const newDisplayName = contact ? contact.label : getAccountNameFromAddress(addr);
					if ($SendTxDetails.toDisplayName !== newDisplayName)
						$SendTxDetails.toDisplayName = newDisplayName;
					warningBody = result.error;
				}
				loading = false;
			});
			getLastPaidContact(getDidFromUsername(addr)).then((res) => {
				lastPaid = momentToLastPaidString(res);
			});
		});
	});

	let warningBody = $state('');
	let warningMsg = $derived(
		!isValid && !loading
			? `Warning: ${warningBody}. Payment to this address may result in loss of funds.`
			: undefined
	);

	const isAddButton = $derived(
		!(loading || $SendTxDetails.toUsername || contact) || ($SendTxDetails.toUsername && !contact)
	);
</script>

<ClickableCard
	onclick={() => {
		if (edit) edit();
	}}
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
				{#if isAddButton}
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
							edit();
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
		text-align: left;
	}
	.name-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		&.padded {
			padding: 0.5rem;
		}
		@media screen and (max-width: 450px) {
			.more {
				display: none;
			}
			flex-wrap: wrap;
		}
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
