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
 * picked up yet. The Wallet menu links to it as "Classic dashboard" so it is
 * reachable rather than orphaned.
 */
export type PageWidth = 'task' | 'wide';

const REDESIGNED: Record<string, PageWidth> = {
	'/swap': 'task',
	'/pools': 'wide',
	'/portfolio': 'wide',
	'/transactions': 'wide',
	'/transfer': 'task',
	'/deposit': 'task',
	'/withdraw': 'task',
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
