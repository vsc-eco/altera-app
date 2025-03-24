import { goto } from '$app/navigation';
import type { Auth } from '$lib/auth/store';
import { paths } from '$lib/paths';

import { actions } from '../../routes/quickActions';

type ActionParams = {
	auth: Auth;
};

type HasLabel = {
	label: string;
};

export type SearchItem = {
	action: (params: ActionParams) => void;
} & HasLabel;

const pathsDict = paths.reduce<{
	[href: string]: {
		label: string;
		href: string;
	};
}>((prev, curr) => {
	prev[curr.href] = {
		label: curr.name,
		href: curr.href
	};
	return prev;
}, {});

const pagesDict = actions.reduce<{
	[href: string]: {
		label: string;
		href: string;
	};
}>((prev, curr) => {
	prev[curr.href] = {
		label: curr.label,
		href: curr.href
	};
	return prev;
}, pathsDict);

const pagesList = Object.values(pagesDict);

const items: {
	[category: string]: {
		items: SearchItem[];
	} & HasLabel;
} = {
	pages: {
		label: 'Pages',
		items: pagesList.map((value) => {
			return {
				label: value.label,
				action: () => goto(value.href)
			};
		})
	},
	actions: {
		label: 'Actions',
		items: [
			{
				label: 'Logout',
				action: ({ auth }) => {
					if (auth.value) {
						auth.value.logout();
					} else {
						console.error('auth is not authenticated yet. Aborting logout.');
					}
				}
			},
			{
				label: 'Open Account Preferences',
				action: ({ auth }) => {
					if (auth.value) {
						auth.value.openSettings();
					} else {
						console.error('auth is not authenticated yet. Aborting opening Account Preferences.');
					}
				}
			}
		]
	}
};

export const flattenedItems: (SearchItem & { categoryLabel: string })[] = Object.keys(
	items
).flatMap((key) => {
	const category = items[key];
	return category.items.map((item) => {
		return {
			...item,
			categoryLabel: category.label
		};
	});
});

export const haystack = flattenedItems.map((item) => {
	return item.label;
});

export const getItemFromIndex = (index: number) => {
	return flattenedItems[index];
};
