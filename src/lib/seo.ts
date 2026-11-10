// Canonical public origin. The same build is served on several hostnames
// (alterawallet.com, altera.okinoko.io, dev hosts); canonical links, the
// sitemap and structured data always point here so search engines
// consolidate them onto one domain.
export const SITE_URL = 'https://alterawallet.com';

export const SITE_NAME = 'Altera';
export const SITE_TITLE = 'Altera — Swap native assets, no wrapping, no bridges';
export const SITE_DESCRIPTION =
	'Swap real BTC, real DASH and real HIVE. Zero fees, non-custodial, any wallet. Powered by Magi Network.';

/** Pages that are meant to show up in search results. Everything else is the
 *  logged-in app (an empty shell to a crawler) and is sent with noindex.
 *  `/` and `/login` render the same server-rendered landing page; the sitemap
 *  lists only `/` and the landing's canonical tag names `/`, so the two URLs
 *  consolidate onto the root. Listing /login here keeps it crawlable (a
 *  noindex header would fight that canonical and could de-index the root). */
export const INDEXABLE_PATHS = ['/', '/login'] as const;
export const SITEMAP_PATHS = ['/'] as const;

export function isIndexablePath(pathname: string): boolean {
	return (INDEXABLE_PATHS as readonly string[]).includes(pathname);
}

/** schema.org description of the site, embedded as JSON-LD on the landing page. */
export const STRUCTURED_DATA = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'WebSite',
			'@id': `${SITE_URL}/#website`,
			url: `${SITE_URL}/`,
			name: SITE_NAME,
			description: SITE_DESCRIPTION
		},
		{
			'@type': 'WebApplication',
			'@id': `${SITE_URL}/#app`,
			name: SITE_NAME,
			url: `${SITE_URL}/`,
			description: SITE_DESCRIPTION,
			applicationCategory: 'FinanceApplication',
			operatingSystem: 'Any',
			browserRequirements: 'Requires JavaScript',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
		}
	]
};
