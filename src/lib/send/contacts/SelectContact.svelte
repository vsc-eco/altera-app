<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { ArrowLeft, Delete, PenLine, Plus, Pointer } from '@lucide/svelte';
	import {
		contactsVersion,
		getAllLastPaid,
		getContacts,
		searchForContacts,
		setAllContacts,
		type Contact
	} from './contacts';
	import CreateContact from './CreateContact.svelte';
	import { contactCard, type ContactObj } from '../stages/components/CardSnippets.svelte';
	import { onMount, untrack } from 'svelte';
	import { momentToLastPaidString, SendTxDetails } from '../sendUtils';

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
				iconInfo: editingMode
					? {
							icon: PenLine,
							hover: true
						}
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
			if (newVal) {
				const contact = getContacts().get(newVal);
				if (contact) {
					if (contact.label !== selectedContact?.label) {
						// remove to prevent close by default
						if (editingMode) {
							openEdit(contact);
							selectedVal = undefined;
						} else {
							selectedContact = contact;
							if (selectedContact.addresses.length === 1) {
								$SendTxDetails.toUsername = selectedContact.addresses[0].address;
							} else {
								$SendTxDetails.toUsername = '';
							}
							close();
						}
					}
					return;
				}
			}
			selectedContact = undefined;
		});
	});
</script>

<div class={['dialog-content', { column: addOpen }]}>
	{#if !addOpen}
		<h5>Select Contact</h5>
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
					<Pointer /> Select
				{:else}
					<PenLine /> Edit
				{/if}
			</PillButton>
			{#if selectedVal}
				<PillButton onclick={() => (selectedVal = undefined)} theme="secondary">
					<Delete /> Clear
				</PillButton>
			{/if}
		</div>
		<div class={{ shaded: editingMode }}>
			<ListBox items={contactObjs} bind:value={selectedVal} customFilter={searchForContacts} />
		</div>
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
		&.column {
			display: flex;
			flex-direction: column;
		}
	}
	.shaded::after {
		content: '';
		position: absolute;
		top: 1rem;
		bottom: 1rem;
		left: 1rem;
		right: 1rem;
		inset: 0;
		background-color: color-mix(in oklch, var(--primary-bg-mid) 7%, transparent);
		pointer-events: none;
		border-radius: 0.5rem;
	}
</style>
