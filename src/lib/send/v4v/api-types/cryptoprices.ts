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

let cached: Cryptoprices | undefined = undefined;
let cachedAt = 0;

export async function getCryptoPrices(options?: { signal?: AbortSignal }): Promise<Cryptoprices> {
	let now = Date.now();
	if (cachedAt > now - 30 * 1000 && cached != undefined) {
		return cached;
	}
	let req = fetch('https://api.v4v.app/v1/cryptoprices/', {
		signal: options?.signal
	});
	if (cached) {
		req.then(async (res) => {
			if (res.ok) {
				let out = await res.json();
				cached = out;
				cachedAt = now;
				return out;
			}
		});
		// return stale cache for this req,
		// fetch fresh data for the next one
		return cached;
	}
	let res = await req;
	if (res.ok) {
		let out = await res.json();
		cached = out;
		cachedAt = now;
		return out;
	}
	throw new Error('Fetch failed.');
}
