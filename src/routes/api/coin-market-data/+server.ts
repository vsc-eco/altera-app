import { json } from '@sveltejs/kit';
import axios from 'axios';
import type { RequestHandler } from '@sveltejs/kit';
import type { CoinMarketResponse } from '$lib/currency/historical';
import { CMC_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	const time_start = url.searchParams.get('time_start');
	const time_end = url.searchParams.get('time_end');
	const interval = url.searchParams.get('interval') || '15m';

	try {
		const response = await axios.get<CoinMarketResponse>(
			'https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/historical',
			{
				params: {
					id,
					time_start: time_start,
					time_end: time_end,
					interval,
					aux: 'price,quote_timestamp'
				},
				headers: {
					'X-CMC_PRO_API_KEY': CMC_API_KEY
				}
			}
		);
		return json(response.data);
	} catch (error) {
		console.error('CoinMarketCap API error:', error);
		return json({ error: 'Failed to fetch crypto data' }, { status: 500 });
	}
};
