<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { ArrowLeft, Plus } from '@lucide/svelte';
	import { getContacts, type Contact } from './contacts';
	import CreateContact from './CreateContact.svelte';
	import { contactCard } from '../stages/components/CardSnippets.svelte';
	import { untrack } from 'svelte';
	import { SendTxDetails } from '../sendUtils';

	let { selectedContact = $bindable() }: { selectedContact: Contact | undefined } = $props();

	let contacts = $state(getContacts());
	let addOpen = $state(false);
	let initialOpen = $state<Contact>();
	let selectedVal = $state<string>();
	let selectedAddress = $state<string>();

	interface ContactObj extends Contact {
		snippet: typeof contactCard;
		snippetData: typeof contactCard.arguments;
		edit: (contact: Contact) => void;
	}
	const contactObjs: ContactObj[] = $derived(
		[...contacts.values()].map((contact) => ({
			...contact,
			snippet: contactCard,
			snippetData: {
				contact: contact,
				size: 'medium'
			},
			edit: openEdit
		}))
	);
	function openEdit(contact: Contact) {
		initialOpen = contact;
		addOpen = true;
	}
	function closeEdit() {
		addOpen = false;
		initialOpen = undefined;
		contacts = getContacts();
	}
	$effect(() => {
		const newVal = selectedVal;
		untrack(() => {
			if (newVal) {
				const contact = getContacts().get(newVal);
				if (contact) {
					selectedContact = contact;
				}
			}
		});
	});
</script>

<!-- {#snippet basicAccRow(params: { address: Contact['addresses'][number]; required?: boolean })}
	<div class="basic-acc-row">
		<span class="sm-caption"
			>{params.address.label ??
				`${params.required ? 'Primary' : 'Additional'} Address` +
					(params.required ? ' *' : '')}</span
		>
		<span>{params.address.address}</span>
	</div>
{/snippet} -->

<!-- {#snippet details(params: { contact: Contact })}
	{@const addressList = params.contact.addresses.map((addr, i) => ({
		label: addr.address,
		snippet: basicAccRow,
		snippetData: {
			address: {
				...addr,
				address: getAccountNameFromAddress(addr.address)
			},
			required: i === 0
		}
	}))}
	<div class="contact-details">
		<ListBox
			items={addressList}
			bind:value={selectedAddress}
			input={false}
			label="Addresses"
			showSelected
		/>
		<PillButton
			onclick={() => {
				initialOpen = params.contact;
				addOpen = true;
			}}
		>
			<PenLine size="16" /> Edit Contact
		</PillButton>
	</div>
{/snippet} -->

<div class="dialog-content">
	{#if !addOpen}
		<h5>Select Contact</h5>
		<div class="add-button">
			<PillButton onclick={() => (addOpen = true)}>
				<Plus /> Create Contact
			</PillButton>
		</div>
		<ListBox items={contactObjs} bind:value={selectedVal} />
	{:else}
		<PillButton onclick={closeEdit} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
		<CreateContact close={closeEdit} initial={initialOpen} />
	{/if}
</div>

<style lang="scss">
	.add-button {
		position: absolute;
		translate: 0 3rem;
		z-index: 3;
	}
	.dialog-content {
		:global(.listbox-ul) {
			margin-top: 2.5rem;
		}
	}
	// .contact-details {
	// 	display: flex;
	// 	align-items: center;
	// 	gap: 1rem;
	// 	:global(.listbox-ul) {
	// 		margin-top: 0;
	// 	}
	// 	:global(.lucide-pen-line) {
	// 		padding-right: 0.25rem;
	// 	}
	// }
	// .basic-acc-row {
	// 	display: flex;
	// 	width: 100%;
	// 	gap: 1.5rem;
	// 	.sm-caption {
	// 		width: 12ch;
	// 		overflow: hidden;
	// 		white-space: nowrap;
	// 		text-overflow: ellipsis;
	// 	}
	// }
</style>
