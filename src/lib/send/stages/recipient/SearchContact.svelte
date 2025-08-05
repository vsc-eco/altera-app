<script lang="ts">
	import {
		getDisplayName,
		getRecentContacts,
		SendTxDetails,
		type recipientData
	} from '../../sendUtils';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import { DHive } from '$lib/vscTransactions/dhive';
	import ContactInfo from '../ContactInfo.svelte';
	import moment from 'moment';
	import { authStore } from '$lib/auth/store';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import { CircleUser } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import type { Snippet } from 'svelte';
	const auth = $derived($authStore);
	let isValidHive = $state(false);
	let lastPaid = $state('Never');
	let recipientUsername: string | undefined = $state($SendTxDetails.toUsername);
	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));

	function setUsername(username: string) {
		getDisplayName(getDidFromUsername(username)).then((displayName) => {
			isValidHive = displayName !== null;
			SendTxDetails.update((current) => ({
				...current,
				// this should be a username not a did, but might be did so this clears that up
				toUsername: getUsernameFromDid(username),
				toDisplayName: displayName ?? username
			}));
		});
	}
	$effect(() => {
		if (recipientUsername !== undefined) {
			setUsername(recipientUsername);
		}
	});

	interface recipientSnippet extends recipientData {
		label: string;
		value: string;
		snippet: (contact: recipientData) => ReturnType<Snippet>;
	}
	let recipients: recipientSnippet[] = $state([]);
	$effect(() => {
		getRecentContacts(auth).then((res) => {
			recipients = res.map((contact) => ({
				...contact,
				label: contact.name,
				value: getUsernameFromDid(contact.did),
				snippet: contactCard
			}));
		});
	});
	function makePlaceholderContact(value: string): recipientSnippet {
		return {
			did: value,
			name: value,
			label: value,
			value: value,
			date: 'donotshow',
			snippet: contactCard
		};
	}
	async function getSuggestedHiveAccounts(value: string): Promise<recipientSnippet[]> {
		if (value === '') return [];
		const result = await DHive.database.call('get_account_reputations', [
			value.toLocaleLowerCase(),
			3
		]);

		return result.map((item: any) => {
			if (item.account)
				return {
					did: item.account,
					name: item.account,
					label: item.account,
					value: item.account,
					date: 'donotshow',
					snippet: contactCard
				};
		});
	}
	let warningMsg = $derived(
		getDidFromUsername($SendTxDetails.toUsername).startsWith('hive:') && !isValidHive
			? 'Warning: This hive account does not exist. Payment to this address may result in loss of funds.'
			: undefined
	);
</script>

{#snippet contactCard(contact: recipientData)}
	<ContactInfo
		did={contact.did}
		name={contact.name}
		accounts={[getUsernameFromDid(contact.did)]}
		lastPaid={contact.date ? `on ${moment(contact.date).format('MMM DD, YYYY')}` : 'Never'}
		adjacent={true}
		detailed={contact.date !== 'donotshow'}
	/>
{/snippet}

<ComboBox
	items={recipients}
	bind:value={recipientUsername}
	custom={true}
	placeholder="Find a contact or paste wallet address"
	createPlaceholder={makePlaceholderContact}
	getSuggestions={getSuggestedHiveAccounts}
/>
<Card>
	<div class="name-card">
		{#if $SendTxDetails.toUsername}
			<ContactInfo
				did={toDid}
				name={$SendTxDetails.toDisplayName}
				accounts={[$SendTxDetails.toUsername]}
				{lastPaid}
				warning={warningMsg}
			/>
		{:else}
			<span class="user-icon-placeholder">
				<CircleUser size={32} />
				Select a Recipient
			</span>
		{/if}
	</div>
</Card>

<style>
	.user-icon-placeholder {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.name-card {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
</style>
