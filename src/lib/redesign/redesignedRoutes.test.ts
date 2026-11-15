import { describe, expect, it } from 'vitest';
import { isRedesigned, pageWidth } from './redesignedRoutes';
import { WALLET_TABS } from './walletTabs';

/**
 * The list in `redesignedRoutes.ts` is the only switch between the two shells,
 * so the two things that can go wrong with it are both regressions a reader
 * would see immediately and a reviewer would not:
 *
 *  1. `/dashboard` slipping INTO the list. It is deliberately left on the old
 *     sidebar shell as the working backup of the controls the redesigned pages
 *     have not picked up yet, and it is linked from the Wallet menu as
 *     "Classic dashboard". Adding it silently deletes that backup.
 *  2. A top-bar destination slipping OUT of it. Every link in the shell's own
 *     nav has to land on a page wearing that same shell, or the nav throws the
 *     reader between two different-looking apps.
 */
describe('redesignedRoutes', () => {
	it('keeps /dashboard on the old shell', () => {
		expect(isRedesigned('/dashboard')).toBe(false);
		expect(isRedesigned('/dashboard/anything')).toBe(false);
	});

	/** Mirrors the nav and the two popups in `AltShell.svelte`, minus the
	 *  deliberate "Classic dashboard" entry asserted above. */
	const topBarDestinations = [
		'/swap',
		'/pools',
		'/portfolio',
		'/transactions',
		'/transfer',
		'/deposit',
		'/custom-tokens',
		'/market',
		'/witness-assistant',
		'/preferences'
	];

	it.each(topBarDestinations)('keeps %s on the redesigned shell', (route) => {
		expect(isRedesigned(route)).toBe(true);
	});

	it('covers sub-routes of a redesigned page', () => {
		expect(isRedesigned('/pools/create')).toBe(true);
		expect(isRedesigned('/market/listing/42')).toBe(true);
	});

	it('does not match a route that merely starts with the same letters', () => {
		expect(isRedesigned('/swapmeet')).toBe(false);
		expect(isRedesigned('/marketing')).toBe(false);
	});

	it('centres task pages and widens list pages', () => {
		expect(pageWidth('/swap')).toBe('task');
		expect(pageWidth('/preferences')).toBe('task');
		expect(pageWidth('/pools')).toBe('wide');
		expect(pageWidth('/portfolio')).toBe('wide');
		expect(pageWidth('/pools/create')).toBe('wide');
	});

	/**
	 * The wallet's five routes share one tab row. If one of them ran at a
	 * different width the row would change size as the reader moved along it,
	 * and the page would stop reading as one place — which is the whole point
	 * of grouping them.
	 */
	it.each(WALLET_TABS.map((tab) => tab.href))('runs %s wide, like its sibling tabs', (href) => {
		expect(isRedesigned(href)).toBe(true);
		expect(pageWidth(href)).toBe('wide');
	});
});
