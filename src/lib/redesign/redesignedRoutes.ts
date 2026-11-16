/**
 * Which routes have moved to the redesign, and how wide each one sits.
 *
 * The redesign replaces the sidebar shell with a top bar, so a page is either
 * fully on the new shell or fully on the old one — there is no halfway, and a
 * nav item pointing at a page still on the sidebar throws the reader between
 * two different apps. Everything the top bar links to is therefore listed here.
 *
 * `task` centres a single card (the handoff's 470px task pages); `wide` is for
 * lists and tables (up to 1120px).
 *
 * `/dashboard` is deliberately absent and should stay that way: it is kept on
 * the old shell as the working backup of the controls the new pages have not
 * picked up yet. Nothing in the top bar links to it any more — it is a URL you
 * type, not a destination the app offers — so it must not resolve here either.
 */
export type PageWidth = 'task' | 'wide';

const REDESIGNED: Record<string, PageWidth> = {
	// The swap screen is the app's front door and owns `/`. `/swap` is a
	// permanent redirect to it and so is deliberately not listed.
	'/': 'task',
	'/pools': 'wide',
	'/portfolio': 'wide',
	'/transactions': 'wide',
	// The five wallet routes carry a shared tab row (see `walletTabs.ts`), so
	// they all run at the same width — a tab row that changes width as you
	// move along it reads as a different page each time. Deposit and Withdraw
	// also lay themselves out at 66rem internally and were being squeezed.
	// The task forms inside Transfer / Deposit / Withdraw still centre at
	// their own width; it is the chrome around them that lines up.
	'/transfer': 'wide',
	'/deposit': 'wide',
	'/withdraw': 'wide',
	'/stake': 'task',
	'/custom-tokens': 'wide',
	'/market': 'wide',
	'/witness-assistant': 'wide',
	'/preferences': 'task'
};

/** The route entry governing `pathname`, including its sub-routes. */
function match(pathname: string): PageWidth | undefined {
	const exact = REDESIGNED[pathname];
	if (exact) return exact;
	for (const [route, width] of Object.entries(REDESIGNED)) {
		if (pathname.startsWith(`${route}/`)) return width;
	}
	return undefined;
}

/** True when `pathname` should render inside the redesigned shell. */
export function isRedesigned(pathname: string): boolean {
	return match(pathname) !== undefined;
}

/** How wide the redesigned shell should run for `pathname`. */
export function pageWidth(pathname: string): PageWidth {
	return match(pathname) ?? 'wide';
}
