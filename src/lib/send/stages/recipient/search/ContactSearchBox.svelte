<script lang="ts">
	import { AtSign, ChevronDown, ChevronUp, Delete } from '@lucide/svelte';
	import * as combobox from '@zag-js/combobox';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import {
		getSuggestedHiveAccounts,
		makePlaceholderContact,
		type BasicRowSnippet,
		type RecipientSnippet,
		type SearchItem
	} from './contactSearch';
	import {
		compareContacts,
		contactsVersion,
		getContacts,
		searchContactsForAddress,
		searchForContacts,
		type Contact
	} from '$lib/send/contacts/contacts';
	import {
		basicAccRow,
		contactCard,
		contactRecentCard,
		type ContactObj
	} from '../../components/CardSnippets.svelte';
	import { getRecentContacts } from '$lib/send/sendUtils';
	import { authStore } from '$lib/auth/store';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	import { untrack, type Snippet } from 'svelte';
	import Divider from '$lib/components/Divider.svelte';

	let {
		value = $bindable(),
		selectedContact = $bindable(),
		enableContacts = true
	}: {
		value: string;
		selectedContact?: Contact | undefined;
		enableContacts?: boolean;
	} = $props();

	const auth = $derived($authStore);
	let recents: RecipientSnippet[] = $state([]);
	$effect(() => {
		if (!auth) return;
		getRecentContacts(auth).then((res) => {
			const recentObjs = res.map((recent) => ({
				...recent,
				label: recent.name ?? getAccountNameFromDid(recent.did),
				value: getUsernameFromDid(recent.did),
				snippet: contactRecentCard
			}));
			recents = recentObjs;
		});
	});
	let contacts = $state.raw(getContacts());
	contactsVersion.subscribe(() => {
		contacts = getContacts();
	});

	const items = $derived([...recents, ...contactsToSortedObjs(contacts)]);

	type ExtraRowObj = {
		value: string;
		disabled?: true;
		snippet: (self: ExtraRowObj) => ReturnType<Snippet>;
	};
	let inputValue = $state<string>();
	let options: (SearchItem | ExtraRowObj)[] = $state.raw((() => items)());
	let open = $state.raw(false);
	let selectedAddrObjs: BasicRowSnippet[] | undefined = $derived(
		selectedContact?.addresses.map((addr, i) => ({
			label: addr.label,
			value: addr.address,
			// have to put this here for the types to reconcile
			snippet: basicAccRow,
			snippetData: {
				address: addr,
				required: i === 0
			}
		}))
	);
	const contactDivider: ExtraRowObj | undefined = $derived(
		selectedContact
			? {
					value: `${selectedContact.label}'s Addresses`,
					disabled: true,
					snippet: divider
				}
			: undefined
	);
	const otherDivider: ExtraRowObj = {
		value: `Other Addresses`,
		disabled: true,
		snippet: divider
	};
	const clearString = 'not_a_valid_account_CLEAR_not_a_valid_account';
	const clearSelection: ExtraRowObj = {
		value: clearString,
		snippet: clearButtonSnippet
	};

	$effect(() => {
		if (inputValue === clearString) {
			inputValue = '';
		}
	});
	$effect(() => {
		value;
		if (!enableContacts) return;
		untrack(() => {
			if (!value) return;
			if (value === clearString) {
				selectedContact = undefined;
				value = inputValue = '';
				return;
			}
			if (selectedContact && getAddresses(selectedContact).includes(value)) {
				return;
			}
			let isContact = contacts.get(value);
			if (!isContact) {
				isContact = searchContactsForAddress(contacts, value);
			}
			if (isContact) {
				if (isContact.label === selectedContact?.label) {
					return;
				}
				selectedContact = isContact;
				if (isContact.addresses.length === 1) {
					if (value !== isContact.addresses[0].address) {
						value = isContact.addresses[0].address;
					}
				} else {
					if (value !== '') {
						console.log('clearing in is contact');
						value = inputValue = '';
					}
				}
			} else {
				if (selectedContact && !getAddresses(selectedContact).includes(value)) {
					selectedContact = undefined;
				}
			}
		});
	});

	function contactToObj(contact: Contact): ContactObj {
		return {
			...contact,
			value: contact.label,
			snippet: contactCard,
			snippetData: {
				contact: contact,
				size: 'medium'
			}
		};
	}

	function getAddresses(contact: Contact) {
		return contact.addresses.map((addr) => addr.address);
	}

	function contactsToSortedObjs(contacts: Map<string, Contact> | Contact[]): ContactObj[] {
		return [...contacts.values()].map((contact) => contactToObj(contact)).sort(compareContacts);
	}

	function includesValueOrLabel(a: SearchItem, val: string) {
		const lowerVal = val.toLowerCase();
		return a.value.toLowerCase().includes(lowerVal) || a.label.toLowerCase().includes(lowerVal);
	}

	function onParamChange(val: string) {
		if (val === '' && selectedContact) {
			options = [contactDivider!, ...selectedAddrObjs!, clearSelection];
			return;
		}
		const currentlyInput = val === '' ? undefined : makePlaceholderContact(val);
		const filteredRecents = recents.filter((recent) => includesValueOrLabel(recent, val));
		const filteredContacts = searchForContacts(contacts, val);
		const currentValue = val;
		getSuggestedHiveAccounts(currentValue).then((suggestedHive) => {
			if (api.inputValue !== currentValue) return;
			const result = new Map<string, SearchItem>();
			let addedAddresses = new Set<string>();

			if (!enableContacts) {
				let allOpts = currentlyInput ? [currentlyInput] : [];
				allOpts.push(...filteredRecents, ...suggestedHive);
				allOpts.forEach((acc) => {
					tryAddItem(acc);
				});
				options = [...result.values()];
				return;
			}

			// helpers
			function tryAddItem(item: SearchItem, addresses: string[] = [item.value]) {
				if (!result.has(item.value) && !addresses.some((addr) => addedAddresses.has(addr))) {
					result.set(item.value, item);
					addresses.forEach((addr) => addedAddresses.add(addr));
				}
			}
			function processContact(contact: Contact) {
				const obj = contactToObj(contact);
				const addresses = getAddresses(contact);
				return { obj, addresses };
			}

			if (currentlyInput) {
				const matchingContact = searchContactsForAddress(filteredContacts, currentlyInput.value);
				if (matchingContact) {
					const { obj, addresses } = processContact(matchingContact);
					tryAddItem(obj, addresses);
				} else {
					tryAddItem(currentlyInput);
				}
			}
			[...filteredRecents, ...suggestedHive].forEach((acc) => {
				const matchingContact = searchContactsForAddress(filteredContacts, acc.value);
				if (matchingContact) {
					const { obj, addresses } = processContact(matchingContact);
					tryAddItem(obj, addresses);
				}
			});
			filteredRecents.forEach((acc) => {
				tryAddItem(acc);
			});
			contactsToSortedObjs(filteredContacts).forEach((contact) => {
				const addresses = contact.addresses.map((addr) => addr.address);
				tryAddItem(contact, addresses);
			});
			suggestedHive.forEach((acc) => {
				tryAddItem(acc);
			});
			if (!selectedContact) {
				options = [...result.values()];
			} else {
				const filteredCurrent = selectedAddrObjs!.filter((obj) => includesValueOrLabel(obj, val));
				const currentOpts = filteredCurrent.length > 0 ? [contactDivider!, ...filteredCurrent] : [];
				result.delete(selectedContact.label);
				options = [...currentOpts, clearSelection, otherDivider, ...result.values()];
			}
		});
	}
	function onDefocus() {
		// don't need to check for item.value === inputValue because it's
		// caught by the ??
		const val = items.find((item) => item.label === inputValue)?.value ?? inputValue;
		if (value !== val) {
			if (selectedContact !== undefined) {
				selectedContact = undefined;
			}
			value = val ?? '';
		}
	}

	const collection = $derived(
		combobox.collection({
			items: options,
			itemToValue: (item) => item.value,
			itemToString: (item) => item.value
		})
	);

	const service = useMachine(combobox.machine, {
		id: getUniqueId(),
		get collection() {
			return collection;
		},
		get value() {
			return value ? [value] : [];
		},
		get inputValue() {
			if (!inputValue && !open) return value;
			return inputValue;
		},
		onOpenChange(details) {
			open = details.open;
			if (details.open) onParamChange(inputValue ?? '');
		},
		onInputValueChange({ inputValue: val }) {
			inputValue = val;
			onParamChange(val);
		},
		onValueChange(details) {
			const val = details.value[0];
			if (value !== val) {
				if (selectedContact !== undefined && !getAddresses(selectedContact).includes(val))
					selectedContact = undefined;
				value = val;
			}
		},
		onFocusOutside: onDefocus,
		onPointerDownOutside: onDefocus,
		onInteractOutside: onDefocus,
		positioning: {
			placement: 'bottom-start',
			gutter: 0,
			flip: false,
			shift: 0,
			sameWidth: true
		},
		openOnClick: enableContacts,
		allowCustomValue: true,
		placeholder: 'Search for contact or address'
	});

	const api = $derived(combobox.connect(service, normalizeProps));
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			onDefocus();
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

{#snippet divider(self: ExtraRowObj)}
	<Divider text={self.value} />
{/snippet}

{#snippet clearButtonSnippet(_: ExtraRowObj)}
	<span class="error clear-selector"><Delete />Clear Selected Contact</span>
{/snippet}

<div {...api.getRootProps()}>
	<label {...api.getLabelProps()}>
		<span class="icon-label">
			<AtSign />
		</span>
	</label>
	<div {...api.getControlProps()}>
		<input {...api.getInputProps()} />
		{#if enableContacts}
			<button {...api.getTriggerProps()}>
				{#if api.open}
					<ChevronUp />
				{:else}
					<ChevronDown />
				{/if}
			</button>
		{/if}
	</div>
</div>
<div {...api.getPositionerProps()}>
	{#if options.length > 0}
		<ul {...api.getContentProps()}>
			{#each options as item}
				<li {...api.getItemProps({ item })}>
					{@render item.snippet('snippetData' in item ? item.snippetData : item)}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	[data-part='root'] {
		position: relative;
		width: 100%;
	}
	[data-part='label'] {
		margin: 0;
		.icon-label {
			color: var(--neutral-bg-mid);
			position: absolute;
			left: 0.25rem;
			top: 0;
			margin: 0.5rem 0 0.5rem 0.25rem;
			:global(svg),
			:global(img) {
				width: 16px;
				height: 16px;
				padding: 4px 0;
				aspect-ratio: 1;
			}
		}
	}
	[data-part='input'] {
		width: 100%;
		box-sizing: border-box;
		padding-left: calc(16px + 0.75rem);
	}
	[data-part='trigger'] {
		position: absolute;
		display: flex;
		align-items: center;
		height: 100%;
		border: none;
		background-color: transparent;
		cursor: pointer;
		top: 0;
		right: 0.5rem;
	}
	[data-part='content'] {
		box-sizing: border-box;
		background-color: var(--neutral-bg);
		border: 1px solid var(--neutral-bg-accent-shifted);
		z-index: 5;
		padding: 0.5rem;
		border-radius: 0 0 0.5rem 0.5rem;
		max-height: var(--available-height);
		max-width: var(--available-width);
		overflow: auto;
		border-top: none;
	}
	[data-part='item'] {
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.5rem;
	}
	[data-part='item'][data-highlighted] {
		background-color: var(--bg-accent);
	}
	[data-part='item'][data-disabled] {
		cursor: default;
	}
	.clear-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 1rem;
	}
</style>
