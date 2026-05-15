import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Returns the build version stamped at deploy time.
 * The client polls this endpoint to detect new deployments.
 * Cache for 60s so we don't hammer the server, but short enough
 * to pick up deploys within a couple of minutes.
 */
export const GET: RequestHandler = async () => {
	return json(
		{
			version: __APP_VERSION__,
			buildTime: __APP_BUILD_TIME__
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60'
			}
		}
	);
};
