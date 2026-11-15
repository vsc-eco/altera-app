/**
 * The wallet is one page with tabs, not five separate pages.
 *
 * Portfolio, Transactions, Transfer, Deposit and Withdraw are all "my account"
 * — the reader moves between them constantly, and before this they were five
 * unrelated screens reachable only by reopening the Wallet menu. They now
 * share one chrome (account total + this tab row), so switching is one click
 * and the page never appears to change identity.
 *
 * The routes themselves are deliberately left where they are. `/transactions`
 * is deep-linked from notifications (`?tx=…&index=…`) and from the old
 * sidebar, and seven `$lib` files import helpers out of the transactions route
 * folder by relative path. Nesting these under `/wallet/*` would buy a tidier
 * URL at the cost of breaking all of that, so the grouping lives in the shell:
 * `(authed)/+layout.svelte` wraps any of these paths in `WalletChrome`.
 *
 * The Wallet dropdown in `AltShell` stays as it is. Each of its items lands on
 * one of these routes, which now means "the wallet page, on that tab".
 */
export type WalletTab = {
	/** The route this tab shows. Also its identity — paths are unique here. */
	href: string;
	label: string;
	/** Sub-line for the same entry in the top bar's Wallet menu. */
	hint: string;
};

/**
 * The tab row, and the Wallet menu, in that order. One list so the two cannot
 * drift: every menu item opens the tab of the same name.
 */
export const WALLET_TABS: readonly WalletTab[] = [
	{ href: '/portfolio', label: 'Assets', hint: 'What you hold' },
	{ href: '/transactions', label: 'Transactions', hint: 'Everything on your account' },
	{ href: '/transfer', label: 'Transfer', hint: 'Send to someone else' },
	{ href: '/deposit', label: 'Deposit', hint: 'Move assets in' },
	{ href: '/withdraw', label: 'Withdraw', hint: 'Move assets out' }
];

/** The tab governing `pathname`, including its sub-routes, or undefined when
 *  the path is not part of the wallet at all. */
export function activeWalletTab(pathname: string): WalletTab | undefined {
	return WALLET_TABS.find(
		(tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
	);
}

/** True when `pathname` should render inside the wallet's tabbed chrome. */
export function isWalletRoute(pathname: string): boolean {
	return activeWalletTab(pathname) !== undefined;
}
