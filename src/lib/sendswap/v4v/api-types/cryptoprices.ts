import { getQuerier } from './query'

export type Cryptoprices = {
	bitcoin: {
		btc: number;
		usd: number;
	};
	hive: {
		btc: number;
		usd: number;
	};
	hive_dollar: {
		btc: number;
		usd: number;
	};
	v4vapp: {
		BTC_USD: number;
		sats_USD: number;
		HBD_USD: number;
		HiveMarket_HBD_USD: number;
		cg_quote: {
			Hive_USD: number;
			HBD_USD: number;
			BTC_USD: number;
			Hive_HBD: number;
			percentage: boolean;
			error: any;
			fetch_date: string;
			quote_age: number;
		};
		cmc_quote: {
			Hive_USD: number;
			HBD_USD: number;
			BTC_USD: number;
			Hive_HBD: number;
			percentage: boolean;
			error: any;
			fetch_date: string;
			quote_age: number;
		};
		binance_quote: {
			Hive_USD: number;
			HBD_USD: number;
			BTC_USD: number;
			Hive_HBD: number;
			percentage: boolean;
			error: any;
			fetch_date: string;
			quote_age: number;
		};
		Hive_USD: number;
		Hive_HBD: number;
		sats_Hive: number;
		sats_HBD: number;
		Hive_sats: number;
		HBD_sats: number;
		fetch_error: Array<any>;
		last_fetch: string;
		fetch_time: number;
		conversion: any;
		redis_hit: boolean;
	};
};

// Routes through a same-origin server proxy (`/api/cryptoprices`) because
// v4v.app stopped sending CORS headers on this endpoint — the browser
// fetch fails with `No 'Access-Control-Allow-Origin' header`. The proxy
// forwards server-to-server, where CORS doesn't apply. Same pattern as
// `/api/gql` (CHANGELOG 0.3.7). Dev-vs-prod v4v selection lives in the
// proxy now (reads PUBLIC_V4VAPP_API_MODE server-side).
const url = '/api/cryptoprices';
export const getCryptoPrices = getQuerier<Cryptoprices>(url);
