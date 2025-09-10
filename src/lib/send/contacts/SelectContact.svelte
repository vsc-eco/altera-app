<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { ArrowLeft, PenLine, Plus, Trash2, X } from '@lucide/svelte';
	import {
		contactsVersion,
		getContacts,
		removeContact,
		searchForContacts,
		type Contact
	} from './contacts';
	import CreateContact from './CreateContact.svelte';
	import { contactCard, type ContactObj } from '../stages/components/SendSnippets.svelte';
	import { untrack } from 'svelte';
	import { SendTxDetails } from '../sendUtils';
	import Confirmation from '$lib/components/Confirmation.svelte';

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
	let editingMode = $state(false);
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
	let valCache: string | undefined = $state();

	$effect(() => {
		const modeUpdate = editingMode;
		untrack(() => {
			if (modeUpdate) {
				valCache = selectedVal;
				selectedVal = undefined;
			} else if (valCache) {
				selectedVal = valCache;
			}
		});
	});

	let currentlyDeleting: Contact | undefined = $state();
	let toggleDeleteWarning = $state<(open?: boolean) => void>(() => {});
	function promptRemove(contact: Contact) {
		currentlyDeleting = contact;
		toggleDeleteWarning(true);
	}

	const contactObjs: ContactObj[] = $derived(
		[...contacts.values()]
			.map((contact) => ({
				...contact,
				value: contact.label,
				snippet: contactCard,
				snippetData: {
					contact: contact,
					size: 'medium'
				},
				icons: editingMode
					? [
							{
								icon: PenLine,
								action: () => openEdit(contact)
							},
							{
								icon: Trash2,
								action: () => promptRemove(contact),
								color: 'var(--secondary-bg-mid)'
							}
						]
					: undefined
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
			const oldContact = selectedContact;
			if (newVal) {
				const contact = getContacts().get(newVal);
				if (contact) {
					if (contact.label !== selectedContact?.label) {
						// remove to prevent close by default
						if (editingMode) {
							return;
						}
						selectedContact = contact;
						$SendTxDetails.toUsername = selectedContact.addresses[0].address;
						if (valCache) {
							valCache = undefined;
						} else {
							close();
						}
					}
					return;
				}
			}
			selectedContact = undefined;
			if (oldContact) $SendTxDetails.toUsername = '';
		});
	});
</script>

<div class={['dialog-content', { column: addOpen }]}>
	{#if !addOpen}
		<h5 class="dialog-list-header">Select Contact</h5>
		<div class="buttons">
			<PillButton onclick={() => (addOpen = true)}>
				<Plus /> Add Contact
			</PillButton>
			<PillButton
				onclick={() => (editingMode = !editingMode)}
				theme="primary"
				styleType={editingMode ? 'default' : 'invert'}
			>
				{#if editingMode}
					<X /> Close
				{:else}
					<PenLine /> Edit
				{/if}
			</PillButton>
		</div>
		<ListBox
			items={contactObjs}
			bind:value={selectedVal}
			customFilter={searchForContacts}
			disabled={editingMode}
		/>
	{:else}
		<PillButton onclick={closeEdit} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
		<CreateContact close={closeEdit} initial={currentlyOpen} />
	{/if}
</div>
<Confirmation
	confirm={() => {
		if (currentlyDeleting) {
			removeContact(currentlyDeleting?.label);
			addOpen = false;
		}
	}}
	bind:toggle={toggleDeleteWarning}
	customConfirm={{ icon: Trash2, text: 'Delete', color: 'secondary' }}
>
	<p>
		Are you sure you want to delete {currentlyDeleting ? currentlyDeleting.label : 'this contact'}?
	</p>
</Confirmation>

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
		&.column {
			display: flex;
			flex-direction: column;
		}
		&:not(.column) {
			position: relative;
		}
	}
</style>
