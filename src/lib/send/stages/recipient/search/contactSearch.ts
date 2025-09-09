import { type Contact } from '$lib/send/contacts/contacts';
import type { RecipientData } from '$lib/send/sendUtils';
import type { Snippet } from 'svelte';
import {
	basicAccRow,
	contactRecentCard,
	type ContactObj
} from '../../components/SendSnippets.svelte';
import { DHive } from '$lib/vscTransactions/dhive';
import { getUsernameFromDid } from '$lib/getAccountName';

export type BasicRowSnippet = {
	label: string;
	value: string;
	snippet: typeof basicAccRow;
	snippetData: typeof basicAccRow.arguments;
};

export type SearchItem = RecipientSnippet | ContactObj | BasicRowSnippet;

export interface RecipientSnippet extends RecipientData {
	label: string;
	value: string;
	snippet:
		| ((contact: RecipientData) => ReturnType<Snippet>)
		| ((contact: Contact) => ReturnType<Snippet>);
}

export function makePlaceholderContact(value: string): RecipientSnippet {
	return {
		did: value,
		name: value,
		label: value,
		value: getUsernameFromDid(value),
		date: 'donotshow',
		snippet: contactRecentCard
	};
}

export async function getSuggestedHiveAccounts(value: string): Promise<RecipientSnippet[]> {
	if (value === '' || value.startsWith('0x')) return [];
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
