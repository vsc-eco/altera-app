<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import ListBox from '$lib/zag/ListBox.svelte';
	import { ArrowLeft, Delete, Plus } from '@lucide/svelte';
	import { getAllLastPaid, getContacts, setAllContacts, type Contact } from './contacts';
	import CreateContact from './CreateContact.svelte';
	import { contactCard } from '../stages/components/CardSnippets.svelte';
	import { onMount, untrack } from 'svelte';
	import { dateToLastPaidString } from '../sendUtils';

	let {
		selectedContact = $bindable(),
		editing = false,
		close
	}: { selectedContact: Contact | undefined; close: () => void; editing?: boolean } = $props();

	let contacts = $state(getContacts());
	let addOpen = $state(editing);
	let currentlyOpen: Contact | undefined = $state(editing ? selectedContact : undefined);
	let selectedVal: string | undefined = $state(selectedContact?.label);

	async function processMap<K, V, R>(
		inputMap: Map<K, V>,
		fn: (value: V, key: K) => Promise<R>
	): Promise<Map<K, PromiseSettledResult<R>>> {
		// Convert Map to array of [key, Promise] pairs
		const entries = Array.from(inputMap.entries()).map(
			([key, value]) => [key, fn(value, key)] as const
		);
		const results = await Promise.allSettled(entries.map(([_, promise]) => promise));
		// Rebuild Map with original keys and corresponding settled results
		return new Map(entries.map(([key], i) => [key, results[i]]));
	}

	onMount(() => {
		processMap<string, Contact, Contact>(contacts, async (contact) => {
			const lastPaidMoment = await getAllLastPaid(contact);
			const lastPaidString = dateToLastPaidString(lastPaidMoment);
			return {
				...contact,
				lastPaid: lastPaidString
			};
		}).then((res) => {
			const unwrapped = new Map<string, Contact>();
			for (const [key, settled] of res) {
				if (settled.status === 'fulfilled') {
					unwrapped.set(key, settled.value);
				} else {
					const oldContact = contacts.get(key);
					if (oldContact) {
						unwrapped.set(key, oldContact);
					}
				}
			}
			contacts = unwrapped;
			setAllContacts(unwrapped);
		});
	});

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

	$inspect(selectedContact);
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
		<ListBox items={contactObjs} bind:value={selectedVal} />
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
