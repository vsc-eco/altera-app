<script lang="ts">
	import { getAccountNameFromAddress, getDidFromUsername } from '$lib/getAccountName';
	import { type Contact } from '$lib/sendswap/contacts/contacts';
	import {
		getLastPaidContact,
		momentToLastPaidString,
		validateAddress
	} from '$lib/sendswap/utils/sendUtils';
	import { useTransferState } from '$lib/sendswap/utils/txState.svelte';
	import { CircleUser, Plus } from '@lucide/svelte';
	import ContactInfo from './info/ContactInfo.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import { untrack } from 'svelte';

	const txState = useTransferState();

	let {
		basic = false,
		contact,
		edit
	}: { basic?: boolean; contact?: Contact; edit?: (isOpen?: boolean) => void } = $props();

	const toDid = $derived(getDidFromUsername(txState.toUsername));
	let lastPaid: string | undefined = $state();
	let isValid = $state(false);
	let loading = $state(false);
	let debounedUsername = $state('');
	$effect(() => {
		const addr = txState.toUsername;
		untrack(() => {
			if (!addr || addr === debounedUsername) return;
			if (!contact) loading = true;
			// only allow internal transfers for the quicksend (basic) card
			validateAddress(addr, basic).then((result) => {
				isValid = result.success;
				if (result.success) {
					const newDisplayName = contact
						? contact.label
						: (result.displayName ?? getAccountNameFromAddress(addr));
					if (txState.toDisplayName !== newDisplayName)
						txState.toDisplayName = newDisplayName;
				} else {
					const newDisplayName = contact ? contact.label : getAccountNameFromAddress(addr);
					if (txState.toDisplayName !== newDisplayName)
						txState.toDisplayName = newDisplayName;
					warningBody = result.error;
				}
				loading = false;
			});
			getLastPaidContact(getDidFromUsername(addr)).then((res) => {
				lastPaid = momentToLastPaidString(res);
			});
			debounedUsername = addr;
		});
	});

	let warningBody = $state('');
	let warningMsg = $derived(
		!isValid && !loading
			? `Warning: ${warningBody}. Payment to this address may result in loss of funds.`
			: undefined
	);

	const isAddButton = $derived(
		!(loading || txState.toUsername || contact) || (txState.toUsername && !contact)
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
				did={txState.toUsername !== '' ? toDid : undefined}
				name={contact.label}
				icon={contact.image}
				accounts={contact.addresses}
				lastPaid={contact.lastPaid}
				size={basic ? 'medium' : 'large'}
				showSelected
			/>
		{:else if txState.toUsername}
			<ContactInfo
				did={toDid}
				name={txState.toDisplayName}
				accounts={[{ address: txState.toUsername, label: 'Primary' }]}
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
					<PillButton
						onclick={(e) => {
							e.stopPropagation();
							edit();
						}}
						styleType="text-subtle"
					>
						<span class="edit">Edit</span>
					</PillButton>
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
