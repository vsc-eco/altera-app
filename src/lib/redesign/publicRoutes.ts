/**
 * Routes a visitor can open without connecting a wallet.
 *
 * The swap screen (`/`) and the pools list (`/pools`) only READ public chain
 * data, so sending a logged-out visitor from either to `/login` is a redirect
 * for nothing — and on `/` it is exactly the "page with redirect" Google
 * flagged in November. Anything that needs an account (adding liquidity,
 * swapping) asks for one in place through the connect dialog instead.
 *
 * The `(authed)` guard reads this list, so a page is public here or nowhere.
 */
export const PUBLIC_ROUTES = ['/', '/pools', '/login'] as const;

export function isPublicRoute(pathname: string): boolean {
	return (PUBLIC_ROUTES as readonly string[]).includes(pathname);
}
