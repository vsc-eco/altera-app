<script lang="ts">
	import { getRecentContacts, SendTxDetails, type recipientData } from '../../sendUtils';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import { DHive } from '$lib/vscTransactions/dhive';
	import ContactInfo from '../components/ContactInfo.svelte';
	import moment from 'moment';
	import { authStore } from '$lib/auth/store';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import { type Snippet } from 'svelte';
	import {
		compareContacts,
		getContacts,
		searchContactsForAddress,
		type Contact
	} from '$lib/send/contacts/contacts';
	import { AtSign } from '@lucide/svelte';
	import { contactCard, type ContactObj } from '../components/CardSnippets.svelte';

	let { contact }: { contact?: Contact } = $props();

	const auth = $derived($authStore);

	interface recipientSnippet extends recipientData {
		label: string;
		value: string;
		snippet:
			| ((contact: recipientData) => ReturnType<Snippet>)
			| ((contact: Contact) => ReturnType<Snippet>);
	}
	let recipients: (recipientSnippet | ContactObj)[] = $state([]);
	$effect(() => {
		getRecentContacts(auth).then((recents) => {
			const contacts = getContacts();
			const noDuplicateRecents = recents.filter(
				(recent) => !searchContactsForAddress(contacts, getUsernameFromDid(recent.did))
			);
			const recentObjs = noDuplicateRecents.map((contact) => ({
				...contact,
				label: contact.name,
				value: getUsernameFromDid(contact.did),
				snippet: contactRecentCard
			}));
			const contactsObjs = [...contacts.values()]
				.map((contact) => ({
					...contact,
					snippet: contactCard,
					snippetData: {
						contact: contact,
						size: 'medium'
					}
				}))
				.sort(compareContacts);
			recipients = [...recentObjs, ...contactsObjs];
		});
	});
	let contactAddresses = $derived(
		contact?.addresses.map((addr, i) => ({
			label: addr.label,
			value: addr.address,
			snippet: basicAccRow,
			snippetData: {
				address: addr,
				required: i === 0
			}
		}))
	);
	$effect(() => {
		if (contact?.addresses.length === 1) {
			$SendTxDetails.toUsername = contact.addresses[0].address;
		}
	});
	function makePlaceholderContact(value: string): recipientSnippet {
		return {
			did: value,
			name: value,
			label: value,
			value: value,
			date: 'donotshow',
			snippet: contactRecentCard
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
					snippet: contactRecentCard
				};
		});
	}
</script>

{#snippet contactRecentCard(contact: recipientData)}
	<ContactInfo
		did={contact.did}
		name={contact.name}
		accounts={[{ address: getUsernameFromDid(contact.did), label: 'Primary Address' }]}
		lastPaid={contact.date ? `on ${moment(contact.date).format('MMM DD, YYYY')}` : 'Never'}
		size="medium"
		detailed={contact.date !== 'donotshow'}
	/>
{/snippet}

{#snippet basicAccRow(params: { address: Contact['addresses'][number]; required?: boolean })}
	<div class="basic-acc-row">
		<span class="sm-caption"
			>{params.address.label ??
				`${params.required ? 'Primary' : 'Additional'} Address` +
					(params.required ? ' *' : '')}</span
		>
		<span>{params.address.address}</span>
	</div>
{/snippet}

{#if !contact}
	<ComboBox
		items={recipients}
		bind:value={$SendTxDetails.toUsername}
		custom
		placeholder="Find a contact or paste wallet address"
		createPlaceholder={makePlaceholderContact}
		getSuggestions={getSuggestedHiveAccounts}
		preferValue
		icon={AtSign}
	/>
{:else}
	<ComboBox
		items={contactAddresses ?? contact.addresses}
		bind:value={$SendTxDetails.toUsername}
		placeholder="Select address from contact"
		dropdown
		preferValue
		icon={AtSign}
	/>
{/if}

<style lang="scss">
	.basic-acc-row {
		display: flex;
		width: 100%;
		gap: 1.5rem;
		.sm-caption {
			width: max(12ch, 25%);
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}
	}
</style>
