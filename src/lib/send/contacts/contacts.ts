import moment, { type Moment } from 'moment';
import { getLastPaidContact } from '../sendUtils';
import { getDidFromUsername } from '$lib/getAccountName';
import { writable } from 'svelte/store';

export const contactsVersion = writable(0);
export type Contact = {
	// name, but label field required by many components
	label: string;
	// usernames not dids
	addresses: { label: string; address: string }[];
	image?: string;
	lastPaid?: string;
};

export function getContacts(): Map<string, Contact> {
	const txString = localStorage.getItem('contacts');
	if (!txString || txString === '{}') return new Map();
	return new Map(JSON.parse(txString) as [string, Contact][]);
}

export function addContact(contact: Contact) {
	const contactMap = getContacts();
	const existing = contactMap.get(contact.label);
	// adds any addresses
	if (existing) {
		existing.addresses = [...existing.addresses, ...contact.addresses].reduce(
			(acc: Contact['addresses'][number][], current) => {
				const existing = acc.find((item) => item.address === current.address);
				if (existing && current.label) {
					existing.label = current.label;
				} else {
					acc.push(current);
				}
				return acc;
			},
			[]
		);
		const currentDate = existing.lastPaid ? moment(existing.lastPaid) : undefined;
		const newDate = contact.lastPaid ? moment(contact.lastPaid) : undefined;
		if (newDate && !(currentDate && currentDate.isAfter(newDate))) {
			existing.lastPaid = contact.lastPaid;
		}
	} else {
		contactMap.set(contact.label, contact);
	}
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
	contactsVersion.update((n) => n + 1);
}

export function setContact(contact: Contact) {
	const contactMap = getContacts();
	contactMap.set(contact.label, contact);
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
	contactsVersion.update((n) => n + 1);
}

export function removeContact(label: string) {
	const contactMap = getContacts();
	contactMap.delete(label);
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
	contactsVersion.update((n) => n + 1);
}

export function setAllContacts(contactMap: Map<string, Contact>) {
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
	contactsVersion.update((n) => n + 1);
}

export async function getAllLastPaid(contact: Contact) {
	const results = await Promise.all(
		contact.addresses.map((addr) => getLastPaidContact(getDidFromUsername(addr.address)))
	);
	const moments = results.filter((item): item is Moment => item !== 'Never');
	if (moments.length === 0) {
		return undefined;
	}
	return moment.max(moments);
}

export function searchForContacts(contacts: Map<string, Contact> | Contact[], substring: string) {
	return [...contacts.values()].filter(
		(contact) =>
			contact.label.toLowerCase().includes(substring.toLowerCase()) ||
			contact.addresses.some((addr) => addr.address.toLowerCase().includes(substring.toLowerCase()))
	);
}

export function searchContactsForAddress(
	contacts: Map<string, Contact> | Contact[],
	address: string,
	label?: string
) {
	if (label && contacts instanceof Map) {
		const nameContact = contacts.get(label);
		if (nameContact?.addresses.some((addr) => addr.address === address)) return nameContact;
	}
	for (const contact of contacts.values()) {
		if (contact?.addresses.some((addr) => addr.address === address)) return contact;
	}
}

export function compareContacts(a: Contact, b: Contact) {
	const aIsNever = a.lastPaid === 'Never' || a.lastPaid === undefined;
	const bIsNever = b.lastPaid === 'Never' || b.lastPaid === undefined;

	if (aIsNever && bIsNever) return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
	if (aIsNever) return 1;
	if (bIsNever) return -1;
	return a.lastPaid!.localeCompare(b.lastPaid!);
}

export async function processMap<K, V, R>(
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
