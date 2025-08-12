<script lang="ts">
	import {
		getDisplayName,
		getRecentContacts,
		SendTxDetails,
		type recipientData
	} from '../../sendUtils';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import { DHive } from '$lib/vscTransactions/dhive';
	import ContactInfo from '../components/ContactInfo.svelte';
	import moment from 'moment';
	import { authStore } from '$lib/auth/store';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import type { Snippet } from 'svelte';
	const auth = $derived($authStore);
	let isValidHive = $state(false);
	let recipientUsername: string | undefined = $state($SendTxDetails.toUsername);

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
		if (recipientUsername !== $SendTxDetails.toUsername) {
			getDisplayName(getDidFromUsername($SendTxDetails.toUsername)).then(
				(displayName) => (isValidHive = displayName !== null)
			);
		}
	});
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
</script>

{#snippet contactCard(contact: recipientData)}
	<ContactInfo
		did={contact.did}
		name={contact.name}
		accounts={[{ address: getUsernameFromDid(contact.did) }]}
		lastPaid={contact.date ? `on ${moment(contact.date).format('MMM DD, YYYY')}` : 'Never'}
		size="medium"
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
