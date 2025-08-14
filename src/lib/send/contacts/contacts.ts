import moment, { type Moment } from 'moment';
import { getLastPaidContact } from '../sendUtils';
import { getDidFromUsername } from '$lib/getAccountName';

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
}

export function setContact(contact: Contact) {
	const contactMap = getContacts();
	contactMap.set(contact.label, contact);
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
}

export function removeContact(label: string) {
	const contactMap = getContacts();
	contactMap.delete(label);
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
}

export function setAllContacts(contactMap: Map<string, Contact>) {
	localStorage.setItem('contacts', JSON.stringify([...contactMap]));
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

export function searchForContacts(contacts: Map<string, Contact>, substring: string) {
	return [...contacts.values()].filter(
		(contact) =>
			contact.label.includes(substring) ||
			contact.addresses.some((addr) => addr.address.includes(substring))
	);
}

export function searchContactsForAddress(
	contacts: Map<string, Contact>,
	address: string,
	label?: string
) {
	if (label) {
		const nameContact = contacts.get(label);
		if (nameContact?.addresses.some((addr) => addr.address === address)) return nameContact;
	}
	for (const contact of contacts.values()) {
		if (contact?.addresses.some((addr) => addr.address === address)) return contact;
	}
}
