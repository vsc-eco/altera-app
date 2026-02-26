/** Sample pool data for the Pools list UI. Replace with real API when available. */
export type TimeRange = '1d' | '7d' | '30d' | 'max';

export interface PoolRow {
	id: string;
	pair: string;
	pairSymbols: [string, string]; // e.g. ['WEC', 'GEC']
	priceRatio: string; // e.g. "0.99999999 GEC/WEC"
	priceInverse: string; // e.g. "1.00000000 WEC/GEC"
	priceUsd: [string, string]; // e.g. ["WEC: $0.07180", "GEC: $0.07180"]
	totalLiquidityUsd: string;
	totalLiquidityAssets: [string, string]; // e.g. ["999,999,998.998 WEC", "999,999,990.873 GEC"]
	feeEarnedUsd: string;
	feeEarnedAssets: [string, string];
	volumeUsd: string;
	volumeAssets: [string, string];
}

export const poolsSampleData: PoolRow[] = [
	{
		id: 'swap-hive-hbd',
		pair: 'SWAP.HIVE:SWAP.HBD',
		pairSymbols: ['SWAP.HIVE', 'SWAP.HBD'],
		priceRatio: '0.07739249 SWAP.HBD/SWAP.HIVE',
		priceInverse: '12.92115036 SWAP.HIVE/SWAP.HBD',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.HBD: $0.35'],
		totalLiquidityUsd: '$1,200,000.00',
		totalLiquidityAssets: ['2,100,000 SWAP.HIVE', '162,500 SWAP.HBD'],
		feeEarnedUsd: '$320.00',
		feeEarnedAssets: ['450 SWAP.HIVE', '58 SWAP.HBD'],
		volumeUsd: '$45,000.00',
		volumeAssets: ['78,000 SWAP.HIVE', '6,030 SWAP.HBD']
	}
];
