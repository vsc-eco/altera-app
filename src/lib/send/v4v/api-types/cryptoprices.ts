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

export async function getCryptoPrices(options?: { signal?: AbortSignal }): Promise<Cryptoprices> {
	return await (await fetch('https://api.v4v.app/v1/cryptoprices/', options)).json();
}
