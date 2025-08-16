<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { ArrowLeft, Delete, Plus } from '@lucide/svelte';
	import {
		contactsVersion,
		getAllLastPaid,
		getContacts,
		searchForContacts,
		setAllContacts,
		type Contact
	} from './contacts';
	import CreateContact from './CreateContact.svelte';
	import { contactCard } from '../stages/components/CardSnippets.svelte';
	import { onMount, untrack } from 'svelte';
	import { dateToLastPaidString } from '../sendUtils';

	let {
		selectedContact = $bindable(),
		editing = false,
		createNew,
		close
	}: {
		selectedContact: Contact | undefined;
		close: () => void;
		editing?: boolean;
		createNew?: string;
	} = $props();

	let contacts = $state(getContacts());
	contactsVersion.subscribe(() => {
		contacts = getContacts();
	});
	let addOpen = $state(editing);
	let currentlyOpen: Contact | undefined = $state(
		editing
			? !selectedContact && createNew
				? {
						label: '',
						addresses: [
							{
								label: 'Primary Address',
								address: createNew
							}
						]
					}
				: selectedContact
			: undefined
	);
	let selectedVal: string | undefined = $state(selectedContact?.label);

	interface ContactObj extends Contact {
		snippet: typeof contactCard;
		snippetData: typeof contactCard.arguments;
		edit: (contact: Contact) => void;
	}
	const contactObjs: ContactObj[] = $derived(
		[...contacts.values()]
			.map((contact) => ({
				...contact,
				snippet: contactCard,
				snippetData: {
					contact: contact,
					size: 'medium'
				},
				edit: openEdit
			}))
			.sort((a, b) => {
				return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
			})
	);
	function openEdit(contact: Contact) {
		currentlyOpen = contact;
		addOpen = true;
	}
	function closeEdit() {
		addOpen = false;
		currentlyOpen = undefined;
		contacts = getContacts();
	}
	$effect(() => {
		const newVal = selectedVal;
		untrack(() => {
			if (newVal) {
				const contact = getContacts().get(newVal);
				if (contact) {
					if (contact.label !== selectedContact?.label) {
						selectedContact = contact;
						// remove to prevent close by default
						close();
					}
					return;
				}
			}
			selectedContact = undefined;
		});
	});
</script>

<div class="dialog-content">
	{#if !addOpen}
		<h5>Select Contact</h5>
		<div class="buttons">
			<PillButton onclick={() => (addOpen = true)}>
				<Plus /> Add Contact
			</PillButton>
			{#if selectedVal}
				<PillButton onclick={() => (selectedVal = undefined)} theme="secondary">
					<Delete /> Clear
				</PillButton>
			{/if}
		</div>
		<ListBox items={contactObjs} bind:value={selectedVal} customFilter={searchForContacts} />
	{:else}
		<PillButton onclick={closeEdit} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
		<CreateContact close={closeEdit} initial={currentlyOpen} />
	{/if}
</div>

<style lang="scss">
	.buttons {
		position: absolute;
		translate: 0 3rem;
		z-index: 3;
	}
	.dialog-content {
		:global(.listbox-ul) {
			margin-top: 2.5rem;
		}
	}
</style>
