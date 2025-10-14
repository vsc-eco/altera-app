<script lang="ts">
	import { getRecentContacts, SendTxDetails, type RecipientData } from '../../../sendUtils';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	import ContactInfo from '../../components/ContactInfo.svelte';
	import moment from 'moment';
	import { authStore, getAuth } from '$lib/auth/store';
	import { untrack } from 'svelte';
	import {
		compareContacts,
		contactsVersion,
		getContacts,
		searchContactsForAddress,
		type Contact
	} from '$lib/send/contacts/contacts';
	import {
		contactCard,
		contactRecentCard,
		type ContactObj
	} from '../../components/SendSnippets.svelte';
	import type { RecipientSnippet } from './contactSearch';
	import ContactSearchBox from './ContactSearchBox.svelte';

	let { contact = $bindable() }: { contact?: Contact } = $props();

	const auth = $derived(getAuth()());

	let contacts = $state(getContacts());
	contactsVersion.subscribe(() => {
		contacts = getContacts();
	});
	let recipientUsername = $state($SendTxDetails.toUsername);
	$effect(() => {
		const newToUsername = $SendTxDetails.toUsername;
		untrack(() => {
			if (recipientUsername !== newToUsername) recipientUsername = newToUsername;
		});
	});
	// $effect(() => {
	// 	const newUsername = recipientUsername;
	// 	untrack(() => {
	// 		let isContact = contacts.get(newUsername);
	// 		if (!isContact) {
	// 			isContact = searchContactsForAddress(contacts, recipientUsername);
	// 		}
	// 		if (isContact) {
	// 			contact = isContact;
	// 		} else {
	// 			if ($SendTxDetails.toUsername !== newUsername) $SendTxDetails.toUsername = newUsername;
	// 		}
	// 	});
	// });

	let recipients: RecipientSnippet[] = $state([]);
	$effect(() => {
		if (!auth) return;
		getRecentContacts(auth).then((recents) => {
			const recentObjs = recents.map((recent) => ({
				...recent,
				label: recent.name ?? getAccountNameFromDid(recent.did),
				value: getUsernameFromDid(recent.did),
				snippet: contactRecentCard
			}));
			recipients = recentObjs;
		});
	});
	let contactAddresses = $derived(
		contact?.addresses.map((addr, i) => ({
			label: addr.label,
			value: addr.address,
			// have to put this here for the types to reconcile
			address: addr.address,
			snippet: basicAccRow,
			snippetData: {
				address: addr,
				required: i === 0
			}
		}))
	);
	// $effect(() => {
	// 	if (contact?.addresses.length === 1) {
	// 		$SendTxDetails.toUsername = contact.addresses[0].address;
	// 		return;
	// 	}
	// 	if (contact?.addresses.some((addr) => addr.address === recipientUsername)) {
	// 		$SendTxDetails.toUsername = recipientUsername;
	// 	}
	// });

	export { contactRecentCard };
</script>

{#snippet basicAccRow(params: { address: Contact['addresses'][number]; required?: boolean })}
	<div class="basic-acc-row">
		<span class="sm-caption">{params.address.label}</span>
		<span>{params.address.address}</span>
	</div>
{/snippet}
