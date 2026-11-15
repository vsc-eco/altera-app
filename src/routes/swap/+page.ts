/**
 * `/swap` is retired — the swap screen is the app's front door and lives at
 * `/` now. Everything that still points here (the old sidebar, bookmarks,
 * links in the wild) is forwarded rather than broken.
 *
 * 308 and not 307: the move is permanent, and a 308 tells search engines to
 * transfer `/swap`'s standing to `/` instead of indexing both.
 *
 * The `?tab=` variants are NOT handled here. `/swap?tab=pools` and
 * `?tab=custom-pools` are forwarded to /pools by the page itself, so the query
 * is carried across and that logic stays in one place.
 */
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	redirect(308, `/${url.search}`);
};
