import { json } from '@sveltejs/kit';
import axios from 'axios';
import type { RequestHandler } from '@sveltejs/kit';
import { CMC_API_KEY } from '$env/static/private';

export interface CoinMarketLatestResponse {
	status: {
		timestamp: string;
		error_code: number;
		error_message: string | null;
		elapsed: number;
		credit_count: number;
		notice: string | null;
	};
	data: {
		[id: string]: {
			id: number;
			name: string;
			symbol: string;
			last_updated?: string;
			quote: Record<
				string,
				{
					price: number;
					last_updated: string;
				}
			>;
		};
	};
}

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	const convert = url.searchParams.get('convert') || 'USD,BTC';

	if (!id) {
		return json({ error: 'id parameter is required' }, { status: 400 });
	}

	try {
		const response = await axios.get<CoinMarketLatestResponse>(
			'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
			{
				params: {
					id,
					convert
				},
				headers: {
					'X-CMC_PRO_API_KEY': CMC_API_KEY,
					Accept: 'application/json'
				}
			}
		);
		return json(response.data);
	} catch (error) {
		console.error('CoinMarketCap API error:', error);
		return json({ error: 'Failed to fetch crypto data' }, { status: 500 });
	}
};
