/**
 * Which routes have moved to the redesign.
 *
 * The redesign replaces the sidebar shell with a top bar, so a page is either
 * fully on the new shell or fully on the old one — there is no halfway. This
 * list is the switch: `(authed)/+layout.svelte` reads it and renders `AltShell`
 * instead of Sidebar + Topbar for anything it names.
 *
 * Add a route here as its page is redesigned. When the list covers every route,
 * the old shell (Sidebar, Topbar, `.app-shell`) can be deleted outright.
 *
 * `/dashboard` is deliberately NOT here and should stay that way for now: it is
 * kept on the old shell as the working backup of the controls the new pages
 * have not picked up yet.
 */
const REDESIGNED = ['/swap', '/pools'];

/** True when `pathname` should render inside the redesigned shell. */
export function isRedesigned(pathname: string): boolean {
	return REDESIGNED.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
