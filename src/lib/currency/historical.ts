import type { Point } from '$lib/LineChart.svelte';
import type { Coin } from '$lib/sendswap/utils/sendOptions';
import axios from 'axios';
import moment from 'moment';
import { get, writable } from 'svelte/store';

export const HistoricalCoinData = writable<Map<string, CoinMarketMapData>>();

export type CoinMarketMapData = {
	id: number;
	name: string;
	symbol: string;
	lastTime: string;
	quotes: Point[];
};

export interface CoinMarketResponse {
	status: {
		timestamp: string;
		error_code: number;
		error_message: string | null;
		elapsed: number;
		credit_count: number;
		notice: string | null;
	};
	data: {
		[ucid: string]: {
			quotes: {
				timestamp: string;
				quote: {
					USD: {
						percent_change_1h: number;
						percent_change_24h: number;
						percent_change_7d: number;
						percent_change_30d: number;
						price: number;
						timestamp: string;
					};
				};
			}[];
			id: number;
			name: string;
			symbol: string;
		};
	};
}

function convertToStore(response: CoinMarketResponse): Map<string, CoinMarketMapData> {
	const map = new Map<string, CoinMarketMapData>();
	Object.entries(response.data).forEach(([id, value]) => {
		map.set(id, {
			...value,
			lastTime: value.quotes[value.quotes.length - 1].timestamp,
			quotes: value.quotes.map((quote) => {
				const inUsd = quote.quote.USD;
				return {
					value: inUsd.price,
					date: new Date(inUsd.timestamp)
				};
			})
		});
	});
	return map;
}

export async function updateHistoricalData(coins: Coin[]) {
	const endTime = moment();
	endTime.minutes(Math.floor(endTime.minutes() / 15) * 15);
	endTime.seconds(0);
	endTime.milliseconds(0);
	const startTime = moment(endTime).subtract(1, 'day');

	const map = get(HistoricalCoinData);

	const allIds = coins.map((coin) => coin.ucid).filter((ucid) => ucid !== undefined);
	const idsToQuery = allIds.filter((ucid) => {
		const existingEntry = map.get(ucid);
		if (!existingEntry) return true;
		const existingTimestamp = moment(existingEntry.lastTime);
		// console.log(
		// 	existingTimestamp.toLocaleString(),
		// 	endTime.toLocaleString(),
		// 	'difference',
		// 	Math.abs(existingTimestamp.diff(endTime, 'minutes'))
		// );
		return Math.abs(existingTimestamp.diff(endTime, 'minutes')) > 1;
	});

	const params = new URLSearchParams();
	params.append('id', idsToQuery.join(','));
	params.append('time_start', startTime.toISOString());
	params.append('time_end', endTime.toISOString());
	params.append('interval', '15m');
	params.append('aux', 'price,quote_timestamp');

	if (idsToQuery.length > 0) {
		// if (false) {
		try {
			const response = await fetch(`/api/coin-market-data?${params}`);
			const responseObj: CoinMarketResponse = (await response.json()) as CoinMarketResponse;
			const converted = convertToStore(responseObj);
			const map = get(HistoricalCoinData);
			converted.forEach((value, ucid) => {
				map.set(ucid, value);
			});
		} catch (err) {
			console.error(err);
			for (const ucid of idsToQuery) {
				map.delete(ucid);
			}
		}
		saveHistoricalCoinData();
	}
}

const STORAGE_KEY = 'historical-coin-data';

export function saveHistoricalCoinData() {
	try {
		const dataArray = Array.from(get(HistoricalCoinData).entries());
		localStorage.setItem(STORAGE_KEY, JSON.stringify(dataArray));
	} catch (error) {
		console.error('Failed to save historical coin data to localStorage:', error);
	}
}

export function loadHistoricalCoinData() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const dataArray: [string, CoinMarketMapData][] = JSON.parse(stored);
			const dataWithDates: [string, CoinMarketMapData][] = dataArray.map(([id, value]) => {
				const newVal: CoinMarketMapData = {
					...value,
					quotes: value.quotes.map((quote) => ({
						value: quote.value,
						date: new Date(quote.date)
					}))
				};
				return [id, newVal];
			});
			HistoricalCoinData.set(new Map(dataWithDates));
		} else {
			HistoricalCoinData.set(new Map());
		}
	} catch (error) {
		console.error('Failed to load historical coin data from localStorage:', error);
		HistoricalCoinData.set(new Map());
	}
}
