import { currentGqlUrl } from '../../client';

export type TimeRange = '1d' | '7d' | '30d' | 'max';

export interface PoolRow {
	id: string;
	pair: string;
	pairSymbols: [string, string];
	priceRatio: string;
	priceInverse: string;
	priceUsd: [string, string];
	totalLiquidityUsd: string;
	totalLiquidityAssets: [string, string];
	feeEarnedUsd: string;
	feeEarnedAssets: [string, string];
	volumeUsd: string;
	volumeAssets: [string, string];
}

// HIVE/HBD DEX:
export const HIVE_HBD_POOL_CONTRACT_ID = 'vsc1Brm1QpGF8WXvRCvwgbpB6fiHtTBJzyZUC9';

// BTC Testnet3 Mapping:
// export const HBD_BTC_POOL_CONTRACT_ID = 'vsc1BYBwMvsSFwqvwzio352VWp6fGkjVs7t3Dp';

// BTC/HBD DEX:
export const HBD_BTC_POOL_CONTRACT_ID = 'vsc1BgwiEg8P5u2qYSV7DL8FCqrj5E7hWSYKmf';


export const HBD_BTC_POOL_KEYS = [
	'reserve0',
	'reserve1',
	'total_lp',
	'asset0',
	'asset1',
	'fee',
	'lp/',
	'fee0',
	'fee1',
	'clp0',
	'clp1',
	'fee_last_claim',
	'asset/',
	'bal/'
] as const;

type PoolState = Record<string, string | null | undefined>;

function parseScaled(raw: string | null | undefined, decimals = 3): number | null {
	if (raw == null) return null;
	const n = Number(raw);
	if (!Number.isFinite(n)) return null;
	return n / 10 ** decimals;
}

function formatAmount(value: number | null, unit: string | null): string {
	if (value == null || unit == null) return 'null';
	return `${value.toLocaleString(undefined, {
		useGrouping: true,
		minimumFractionDigits: 3,
		maximumFractionDigits: 3
	})} ${unit.toUpperCase()}`;
}

function formatFee(raw: string | null | undefined, unit: string): string {
	const value = parseScaled(raw, 3);
	if (value == null) return 'null';
	const formatted = value.toLocaleString(undefined, {
		useGrouping: true,
		minimumFractionDigits: 3,
		maximumFractionDigits: 3
	});
	return unit === '$' ? `$${formatted}` : `${formatted} ${unit.toUpperCase()}`;
}

function mapStateToPoolRow(state: PoolState): PoolRow {
	const asset0Json = state['asset0'];
	const asset1Json = state['asset1'];
	const asset0 = asset0Json ? JSON.parse(asset0Json) : null;
	const asset1 = asset1Json ? JSON.parse(asset1Json) : null;
	const sym0 = (asset0?.asset as string | undefined)?.toUpperCase?.() ?? 'HBD';
	const sym1 = (asset1?.asset as string | undefined)?.toUpperCase?.() ?? 'BTC';
	const pairSym0 = `SWAP.${sym0}`;
	const pairSym1 = `SWAP.${sym1}`;

	const reserve0 = parseScaled(state['reserve0']);
	const reserve1 = parseScaled(state['reserve1']);

	const ratio =
		reserve0 != null && reserve0 !== 0 && reserve1 != null ? reserve1 / reserve0 : null;
	const inverse =
		reserve1 != null && reserve1 !== 0 && reserve0 != null ? reserve0 / reserve1 : null;

	const priceRatio =
		ratio != null
			? `${ratio.toFixed(8)} ${pairSym1}/${pairSym0}`
			: 'null';
	const priceInverse =
		inverse != null
			? `${inverse.toFixed(8)} ${pairSym0}/${pairSym1}`
			: 'null';

	const totalLiquidityAssets: [string, string] = [
		formatAmount(reserve0, sym0),
		formatAmount(reserve1, sym1)
	];

	const fee = state['fee'];
	const fee0 = state['fee0'];
	const fee1 = state['fee1'];

	const feeEarnedUsd = formatFee(fee, '$');
	const feeEarnedAssets: [string, string] = [
		formatFee(fee0, sym0),
		formatFee(fee1, sym1)
	];

	return {
		id: 'swap-hbd-btc',
		pair: `${pairSym0}:${pairSym1}`,
		pairSymbols: [pairSym0, pairSym1],
		priceRatio,
		priceInverse,
		priceUsd: ['null', 'null'],
		totalLiquidityUsd: 'null',
		totalLiquidityAssets,
		feeEarnedUsd,
		feeEarnedAssets,
		volumeUsd: 'null',
		volumeAssets: ['null', 'null']
	};
}

const GET_POOL_STATE_QUERY = `
	query GetPoolState($contractId: String!, $keys: [String!]!) {
		getStateByKeys(contractId: $contractId, keys: $keys)
	}
`;

export async function fetchPools(): Promise<PoolRow[]> {
	try {
		const response = await fetch(currentGqlUrl + '/api/v1/graphql', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: GET_POOL_STATE_QUERY,
				variables: {
					contractId: HBD_BTC_POOL_CONTRACT_ID,
					keys: HBD_BTC_POOL_KEYS
				}
			})
		});
		const json = await response.json();
		const state = (json?.data?.getStateByKeys ?? {}) as PoolState;
		return [mapStateToPoolRow(state)];
	} catch (err) {
		console.error('Failed to fetch pool state', err);
		return [];
	}
}
