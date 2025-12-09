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
	} from '$lib/sendswap/contacts/contacts';
	import {
		basicAccRow,
		contactCard,
		contactRecentCard,
		type ContactObj
	} from '../components/info/SendSnippets.svelte';
	import { getRecentContacts } from '$lib/sendswap/utils/sendUtils';
	import { getAuth } from '$lib/auth/store';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	import { untrack, type Snippet } from 'svelte';
	import Divider from '$lib/components/Divider.svelte';
	import PillButton from '$lib/PillButton.svelte';

	type Option = 'hive' | 'recent' | 'contacts';

	let {
		value = $bindable(),
		selectedContact = $bindable(),
		enableContacts = ['hive', 'recent', 'contacts'],
		placeholder = 'Search for contact or address'
	}: {
		value: string;
		selectedContact?: Contact | undefined;
		enableContacts?: Option[];
		placeholder?: string;
	} = $props();

	const enableHive = $derived(enableContacts.includes('hive'));
	const enableRecent = $derived(enableContacts.includes('recent'));
	const enableContactsList = $derived(enableContacts.includes('contacts'));
	const hasAnyContacts = $derived(enableContactsList || enableRecent);

	const auth = $derived(getAuth()());
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

	let isTimedOut = $state(false);
	let selectedTimeout: ReturnType<typeof setTimeout>;
	function clearValues() {
		selectedContact = undefined;
		value = inputValue = '';
	}
	$effect(() => {
		value;
		calculateInputWidth();
		if (!enableContactsList) return;
		untrack(() => {
			if (!value) return;
			if (value === clearString) {
				clearValues();
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
				if (value !== isContact.addresses[0].address) {
					value = inputValue = isContact.addresses[0].address;
					isTimedOut = true;
					selectedTimeout = setTimeout(() => {
						isTimedOut = false;
					}, 200);
				}
			} else {
				if (selectedContact && !getAddresses(selectedContact).includes(value)) {
					selectedContact = undefined;
				}
			}
		});
	});
	$effect(() => {
		if (value && !inputValue && !open) {
			inputValue = value;
			isTimedOut = true;
			selectedTimeout = setTimeout(() => {
				isTimedOut = false;
			}, 200);
		}
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
			options = [contactDivider!, ...selectedAddrObjs!];
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

			// If contacts are disabled, show simpler list
			if (!enableContactsList) {
				let allOpts = currentlyInput ? [currentlyInput] : [];
				if (enableRecent) {
					allOpts.push(...filteredRecents);
				}
				if (enableHive) {
					allOpts.push(...suggestedHive);
				}
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
				const matchingContact = enableContactsList
					? searchContactsForAddress(filteredContacts, currentlyInput.value)
					: undefined;
				if (matchingContact) {
					const { obj, addresses } = processContact(matchingContact);
					tryAddItem(obj, addresses);
				} else {
					tryAddItem(currentlyInput);
				}
			}
			const itemsToProcess: SearchItem[] = [];
			if (enableRecent) {
				itemsToProcess.push(...filteredRecents);
			}
			if (enableHive) {
				itemsToProcess.push(...suggestedHive);
			}
			itemsToProcess.forEach((acc) => {
				const matchingContact = enableContactsList
					? searchContactsForAddress(filteredContacts, acc.value)
					: undefined;
				if (matchingContact) {
					const { obj, addresses } = processContact(matchingContact);
					tryAddItem(obj, addresses);
				}
			});
			if (enableRecent) {
				filteredRecents.forEach((acc) => {
					tryAddItem(acc);
				});
			}
			if (enableContactsList) {
				contactsToSortedObjs(filteredContacts).forEach((contact) => {
					const addresses = contact.addresses.map((addr) => addr.address);
					tryAddItem(contact, addresses);
				});
			}
			if (enableHive) {
				suggestedHive.forEach((acc) => {
					tryAddItem(acc);
				});
			}
			if (!selectedContact) {
				options = [...result.values()];
			} else {
				const filteredCurrent = selectedAddrObjs!.filter((obj) => includesValueOrLabel(obj, val));
				const currentOpts = filteredCurrent.length > 0 ? [contactDivider!, ...filteredCurrent] : [];
				result.delete(selectedContact.label);
				options = [...currentOpts, otherDivider, ...result.values()];
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

	const service = $derived(
		useMachine(combobox.machine, {
			id: getUniqueId(),
			get collection() {
				return collection;
			},
			get value() {
				return value ? [value] : [];
			},
			get inputValue() {
				return inputValue;
			},
			onOpenChange(details) {
				open = details.open;
				if (details.open) {
					if (selectedContact && details.reason === 'trigger-click') {
						options = [contactDivider!, ...selectedAddrObjs!];
					} else {
						onParamChange(inputValue ?? '');
					}
				}
			},
			onInputValueChange({ inputValue: val }) {
				if (!isTimedOut) inputValue = val;
				onParamChange(val);
			},
			onValueChange(details) {
				const val = details.value[0];
				if (value !== val) {
					if (selectedContact !== undefined && !getAddresses(selectedContact).includes(val)) {
						selectedContact = undefined;
					}
					inputValue = val;
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
			openOnClick: hasAnyContacts,
			allowCustomValue: true,
			placeholder: placeholder
		})
	);

	const api = $derived(combobox.connect(service, normalizeProps));
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			onDefocus();
		}
	}

	let showAccLabel = $state(false);
	function calculateInputWidth() {
		const inputId = api.getInputProps().id;
		if (!inputId) return;
		const inputElement = document.getElementById(inputId);
		const accNameElement = document.getElementById('acc-value-label');
		const inputWidth = inputElement?.clientWidth;
		const accNameWidth = accNameElement?.clientWidth;
		if (!accNameWidth || !inputWidth || accNameWidth > inputWidth - 102) {
			showAccLabel = false;
		} else {
			showAccLabel = true;
		}
	}
</script>

<svelte:window on:keydown={handleKeyDown} on:resize={calculateInputWidth} />

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
		<input
			{...api.getInputProps()}
			class={{ trigger: hasAnyContacts, both: hasAnyContacts && (inputValue || value) }}
		/>
		{#if hasAnyContacts}
			{#if selectedContact && value && !open}
				{@const label = selectedContact.addresses.find((addr) => addr.address === value)?.label}
				<span class={['acc-name', { hide: !showAccLabel }]} id="acc-value-label">
					<span class="invisible">
						{value}
					</span>
					<span class="sm-caption">{label}</span>
				</span>
			{/if}
			{#if inputValue || value}
				<span class="delete-button">
					<PillButton onclick={clearValues} styleType="icon-subtle">
						<Delete color="var(--secondary-bg-mid)" />
					</PillButton>
				</span>
			{/if}
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
		&.trigger {
			padding-right: 2.25rem;
		}
		&.both {
			padding-right: 4.5rem;
		}
		text-overflow: ellipsis;
	}
	[data-part='input'][data-state='open'] {
		box-shadow: 0 -1px inset var(--primary-bg-mid);
		border-bottom-color: var(--primary-bg-mid);
		outline: none;
		border-radius: 0.5rem 0.5rem 0 0;
	}
	[data-part='trigger'],
	.delete-button {
		position: absolute;
		display: flex;
		align-items: center;
		height: 100%;
		border: none;
		background-color: transparent;
		cursor: pointer;
		top: 0;
		right: 0.5rem;
		color: var(--neutral-fg);
	}
	.delete-button {
		right: 2.5rem;
	}
	.acc-name {
		position: absolute;
		top: 0.75rem;
		left: 2.25rem;
		user-select: none;
		pointer-events: none;
		display: flex;
		align-items: flex-end;
		white-space: nowrap;
		max-width: calc(100% - 100px);
		overflow: hidden;
		white-space: nowrap;
		.invisible {
			visibility: hidden;
		}
		&.hide {
			visibility: hidden;
		}
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
		background-color: var(--highlighted-bg);
	}
	[data-part='item'][data-disabled] {
		padding: 0 0.5rem;
		cursor: default;
	}
	.clear-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 1rem;
	}
</style>
