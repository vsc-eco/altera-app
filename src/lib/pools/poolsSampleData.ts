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
		id: 'wec-gec',
		pair: 'WEC:GEC',
		pairSymbols: ['WEC', 'GEC'],
		priceRatio: '0.99999999 GEC/WEC',
		priceInverse: '1.00000000 WEC/GEC',
		priceUsd: ['WEC: $0.07180', 'GEC: $0.07180'],
		totalLiquidityUsd: '$143,591,999.273',
		totalLiquidityAssets: ['999,999,998.998 WEC', '999,999,990.873 GEC'],
		feeEarnedUsd: '$0.00146',
		feeEarnedAssets: ['0 WEC', '0.02 GEC'],
		volumeUsd: '$1.169',
		volumeAssets: ['8.15 WEC', '8.129 GEC']
	},
	{
		id: 'dec-sps',
		pair: 'DEC:SPS',
		pairSymbols: ['DEC', 'SPS'],
		priceRatio: '0.25 SPS/DEC',
		priceInverse: '4.00 DEC/SPS',
		priceUsd: ['DEC: $0.12', 'SPS: $0.48'],
		totalLiquidityUsd: '$892,450.00',
		totalLiquidityAssets: ['1,250,000 DEC', '312,500 SPS'],
		feeEarnedUsd: '$124.50',
		feeEarnedAssets: ['520 DEC', '130 SPS'],
		volumeUsd: '$45,230.00',
		volumeAssets: ['125,000 DEC', '31,250 SPS']
	},
	{
		id: 'swap-hive-btc',
		pair: 'SWAP.HIVE:SWAP.BTC',
		pairSymbols: ['SWAP.HIVE', 'SWAP.BTC'],
		priceRatio: '0.00001234 SWAP.BTC/SWAP.HIVE',
		priceInverse: '81,039.00 SWAP.HIVE/SWAP.BTC',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.BTC: $28,500.00'],
		totalLiquidityUsd: '$2,450,000.00',
		totalLiquidityAssets: ['5,000,000 SWAP.HIVE', '61.40 SWAP.BTC'],
		feeEarnedUsd: '$1,240.00',
		feeEarnedAssets: ['2,100 SWAP.HIVE', '0.025 SWAP.BTC'],
		volumeUsd: '$312,000.00',
		volumeAssets: ['620,000 SWAP.HIVE', '7.6 SWAP.BTC']
	},
	{
		id: 'swap-hive-sps',
		pair: 'SWAP.HIVE:SPS',
		pairSymbols: ['SWAP.HIVE', 'SPS'],
		priceRatio: '1.45 SPS/SWAP.HIVE',
		priceInverse: '0.69 SWAP.HIVE/SPS',
		priceUsd: ['SWAP.HIVE: $0.35', 'SPS: $0.51'],
		totalLiquidityUsd: '$456,780.00',
		totalLiquidityAssets: ['650,000 SWAP.HIVE', '450,000 SPS'],
		feeEarnedUsd: '$89.00',
		feeEarnedAssets: ['120 SWAP.HIVE', '88 SPS'],
		volumeUsd: '$12,400.00',
		volumeAssets: ['18,000 SWAP.HIVE', '12,200 SPS']
	},
	{
		id: 'bee-swap-btc',
		pair: 'BEE:SWAP.BTC',
		pairSymbols: ['BEE', 'SWAP.BTC'],
		priceRatio: '0.00000082 SWAP.BTC/BEE',
		priceInverse: '1,219,512.20 BEE/SWAP.BTC',
		priceUsd: ['BEE: $0.023', 'SWAP.BTC: $28,500.00'],
		totalLiquidityUsd: '$89,200.00',
		totalLiquidityAssets: ['2,100,000 BEE', '0.73 SWAP.BTC'],
		feeEarnedUsd: '$12.40',
		feeEarnedAssets: ['280 BEE', '0.00018 SWAP.BTC'],
		volumeUsd: '$3,100.00',
		volumeAssets: ['68,000 BEE', '0.055 SWAP.BTC']
	},
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
	},
	{
		id: 'swap-hive-steem',
		pair: 'SWAP.HIVE:SWAP.STEEM',
		pairSymbols: ['SWAP.HIVE', 'SWAP.STEEM'],
		priceRatio: '1.02 SWAP.STEEM/SWAP.HIVE',
		priceInverse: '0.98 SWAP.HIVE/SWAP.STEEM',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.STEEM: $0.34'],
		totalLiquidityUsd: '$890,000.00',
		totalLiquidityAssets: ['1,500,000 SWAP.HIVE', '1,530,000 SWAP.STEEM'],
		feeEarnedUsd: '$180.00',
		feeEarnedAssets: ['280 SWAP.HIVE', '285 SWAP.STEEM'],
		volumeUsd: '$22,000.00',
		volumeAssets: ['35,000 SWAP.HIVE', '35,700 SWAP.STEEM']
	},
	{
		id: 'swap-hive-ltc',
		pair: 'SWAP.HIVE:SWAP.LTC',
		pairSymbols: ['SWAP.HIVE', 'SWAP.LTC'],
		priceRatio: '0.0021 SWAP.LTC/SWAP.HIVE',
		priceInverse: '476.19 SWAP.HIVE/SWAP.LTC',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.LTC: $165.00'],
		totalLiquidityUsd: '$520,000.00',
		totalLiquidityAssets: ['900,000 SWAP.HIVE', '1,890 SWAP.LTC'],
		feeEarnedUsd: '$95.00',
		feeEarnedAssets: ['150 SWAP.HIVE', '0.31 SWAP.LTC'],
		volumeUsd: '$12,500.00',
		volumeAssets: ['22,000 SWAP.HIVE', '46 SWAP.LTC']
	},
	{
		id: 'swap-hive-bch',
		pair: 'SWAP.HIVE:SWAP.BCH',
		pairSymbols: ['SWAP.HIVE', 'SWAP.BCH'],
		priceRatio: '0.00089 SWAP.BCH/SWAP.HIVE',
		priceInverse: '1,123.60 SWAP.HIVE/SWAP.BCH',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.BCH: $395.00'],
		totalLiquidityUsd: '$380,000.00',
		totalLiquidityAssets: ['650,000 SWAP.HIVE', '578 SWAP.BCH'],
		feeEarnedUsd: '$62.00',
		feeEarnedAssets: ['98 SWAP.HIVE', '0.087 SWAP.BCH'],
		volumeUsd: '$8,200.00',
		volumeAssets: ['14,000 SWAP.HIVE', '12.5 SWAP.BCH']
	},
	{
		id: 'swap-hive-doge',
		pair: 'SWAP.HIVE:SWAP.DOGE',
		pairSymbols: ['SWAP.HIVE', 'SWAP.DOGE'],
		priceRatio: '12.5 SWAP.DOGE/SWAP.HIVE',
		priceInverse: '0.08 SWAP.HIVE/SWAP.DOGE',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.DOGE: $0.028'],
		totalLiquidityUsd: '$290,000.00',
		totalLiquidityAssets: ['500,000 SWAP.HIVE', '6,250,000 SWAP.DOGE'],
		feeEarnedUsd: '$48.00',
		feeEarnedAssets: ['75 SWAP.HIVE', '937,500 SWAP.DOGE'],
		volumeUsd: '$5,800.00',
		volumeAssets: ['10,000 SWAP.HIVE', '125,000 SWAP.DOGE']
	},
	{
		id: 'swap-hive-eth',
		pair: 'SWAP.HIVE:SWAP.ETH',
		pairSymbols: ['SWAP.HIVE', 'SWAP.ETH'],
		priceRatio: '0.00573 SWAP.ETH/SWAP.HIVE',
		priceInverse: '174.52 SWAP.HIVE/SWAP.ETH',
		priceUsd: ['SWAP.HIVE: $0.35', 'SWAP.ETH: $2,007.00'],
		totalLiquidityUsd: '$1,800,000.00',
		totalLiquidityAssets: ['3,200,000 SWAP.HIVE', '896 SWAP.ETH'],
		feeEarnedUsd: '$410.00',
		feeEarnedAssets: ['680 SWAP.HIVE', '0.19 SWAP.ETH'],
		volumeUsd: '$95,000.00',
		volumeAssets: ['170,000 SWAP.HIVE', '47 SWAP.ETH']
	},
	{
		id: 'swap-btc-eth',
		pair: 'SWAP.BTC:SWAP.ETH',
		pairSymbols: ['SWAP.BTC', 'SWAP.ETH'],
		priceRatio: '14.20 SWAP.ETH/SWAP.BTC',
		priceInverse: '0.0704 SWAP.BTC/SWAP.ETH',
		priceUsd: ['SWAP.BTC: $28,500.00', 'SWAP.ETH: $2,007.00'],
		totalLiquidityUsd: '$5,120,000.00',
		totalLiquidityAssets: ['89.82 SWAP.BTC', '1,276 SWAP.ETH'],
		feeEarnedUsd: '$4,560.00',
		feeEarnedAssets: ['0.08 SWAP.BTC', '1.14 SWAP.ETH'],
		volumeUsd: '$890,000.00',
		volumeAssets: ['15.6 SWAP.BTC', '222 SWAP.ETH']
	}
];
