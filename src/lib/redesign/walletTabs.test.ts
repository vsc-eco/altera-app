import { describe, expect, it } from 'vitest';
import { WALLET_TABS, activeWalletTab, isWalletRoute } from './walletTabs';

describe('walletTabs', () => {
	it('marks each wallet route as its own tab', () => {
		for (const tab of WALLET_TABS) {
			expect(activeWalletTab(tab.href)).toBe(tab);
		}
	});

	it('keeps a sub-route on its parent tab', () => {
		// `/transactions` is deep-linked with a path in some notifications.
		expect(activeWalletTab('/transactions/abc')?.label).toBe('Transactions');
	});

	it('leaves the rest of the app alone', () => {
		for (const path of ['/swap', '/pools', '/dashboard', '/preferences', '/market']) {
			expect(isWalletRoute(path)).toBe(false);
		}
	});

	it('does not match a route that merely starts with a tab path', () => {
		expect(isWalletRoute('/transferable')).toBe(false);
		expect(isWalletRoute('/depositors')).toBe(false);
	});

	/** The old dashboard is NOT a tab: it is on the previous shell, which has
	 *  no tab row to belong to, and the Wallet menu no longer offers it. */
	it('does not make the classic dashboard a tab', () => {
		expect(activeWalletTab('/dashboard')).toBeUndefined();
	});

	it('starts on Portfolio and offers both directions of moving funds', () => {
		// Named for the route it opens, which was always `/portfolio`.
		expect(WALLET_TABS[0].label).toBe('Portfolio');
		expect(WALLET_TABS[0].href).toBe('/portfolio');
		const labels = WALLET_TABS.map((tab) => tab.label);
		expect(labels).toContain('Deposit');
		expect(labels).toContain('Withdraw');
		// Swap is a top-bar destination of its own, not a wallet tab.
		expect(labels).not.toContain('Swap');
	});
});
