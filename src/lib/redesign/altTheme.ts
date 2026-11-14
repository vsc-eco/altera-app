import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/** The redesign's three themes. Glass is the default — it is the closest to
 *  the site as it looks today. */
export type AltTheme = 'glass' | 'flat' | 'light';

export const ALT_THEMES: { value: AltTheme; label: string }[] = [
	{ value: 'glass', label: 'Glass' },
	{ value: 'flat', label: 'Flat' },
	{ value: 'light', label: 'Light' }
];

const STORAGE_KEY = 'alt-theme';

function read(): AltTheme {
	if (!browser) return 'glass';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'glass' || stored === 'flat' || stored === 'light') return stored;
	} catch {
		// Private windows and blocked site data throw on access; the default is fine.
	}
	return 'glass';
}

export const altTheme = writable<AltTheme>(read());

altTheme.subscribe((value) => {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, value);
	} catch {
		// Not being able to remember the choice must not break switching it.
	}
});

/** The class the page wrapper wears, which is what `redesign.scss` keys on. */
export function altThemeClass(theme: AltTheme): string {
	return theme === 'glass' ? '' : `alt-${theme}`;
}
