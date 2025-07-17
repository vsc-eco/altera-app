import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { Laptop, Sun, Moon } from '@lucide/svelte';

export type ThemeValue = 'system' | 'light' | 'dark';
type ThemeInfo = {
	value: ThemeValue;
	label: string;
};
export const THEMES: Record<ThemeValue, ThemeInfo> = {
	system: { value: 'system', label: 'System Preference' },
	light: { value: 'light', label: 'Light' },
	dark: { value: 'dark', label: 'Dark' }
};

export function getInitialTheme(): ThemeValue {
	if (!browser) return 'system';
	const fromStorage = localStorage.getItem('theme');
	if (fromStorage && fromStorage in THEMES) {
		return fromStorage as ThemeValue;
	}
	return 'system';
}

export const themeStore = writable<ThemeInfo>(THEMES[getInitialTheme()]);

themeStore.subscribe((value) => {
	if (!browser) return;

	localStorage.setItem('theme', value.value);
	updateThemeClass(value.value);
});

function updateThemeClass(themeValue: string) {
	const root = document.documentElement;

	// Remove existing theme classes
	root.classList.remove('light-theme', 'dark-theme');

	if (themeValue === 'light') {
		root.classList.add('light-theme');
	} else if (themeValue === 'dark') {
		root.classList.add('dark-theme');
	}
}
