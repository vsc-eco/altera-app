import type { RequestHandler } from '@sveltejs/kit';
import { SITE_URL, SITEMAP_PATHS } from '$lib/seo';

// Only the public landing pages are listed. Every app page behind the wallet
// login is an empty shell to a crawler and is served with noindex.
export const GET: RequestHandler = () => {
	const urls = SITEMAP_PATHS.map(
		(path) => `\t<url>\n\t\t<loc>${SITE_URL}${path}</loc>\n\t</url>`
	).join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
