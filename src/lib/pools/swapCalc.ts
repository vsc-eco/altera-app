/**
 * Pool reserves, and the route a swap takes between them.
 *
 * ⚠️ **The swap arithmetic itself has moved to `$lib/calc`.** Everything that
 * multiplies — the constant-product invariant, the two fee legs, the
 * stabilizer, `min_amount_out`, price impact, the depth check — lives there
 * now, next to every other number the app works out. This module is what it
 * always should have been: the part that talks to the chain and the indexer,
 * and the part that decides WHICH pools a pair routes through.
 *
 * The calc entry points are re-exported below, so `import { calculateSwap }
 * from '$lib/pools/swapCalc'` still resolves and `swapCalcConsumers.test.ts`
 * (the drift guard that pins QuickSwap and SwapOptions to this module) keeps
 * working. New code can import either path; `$lib/calc` is the shorter one.
 *
 * Amounts are in smallest units throughout (3 dp for HIVE/HBD, 8 for BTC).
 */

import { GetStateByKeysStore } from '$houdini';
import { isVscTestnet } from '../../client';
import { queryOnce } from '$lib/queryOnce';
import { fetchPoolRegistry, fetchPoolLiquiditySnapshot } from './poolsData';
import {
	buildSwapRoute,
	type SwapHop,
	type SlipFeeRule,
	type TypedPoolDepths,
	type PoolDepths,
	DEX_BASE_ASSET,
	priceImpactForRoute,
	exceedsPoolDepthForRoute,
	setSlipFeeRule
} from '$lib/calc';

export {
	// Fee constants
	STABILIZER_CAP_BPS,
	CLP_SCALE_BPS,
	BPS_SCALE,
	PROTOCOL_FEE_BPS,
	DEX_BASE_ASSET,
	// Safety guard
	SWAP_FEE_GUARD_BPS,
	SWAP_FEE_GUARD_PARITY_BPS,
	swapFeeExceedsGuard,
	swapFeeGuardMessage,
	swapFeeLabelPct,
	// Quote math
	calculateSwap,
	calculateTwoHopSwap,
	calculateRouteSwap,
	constantProductOut,
	feeBpsOf,
	getOrderedDepths,
	getOrderedDepthsFor,
	// Routing math
	buildSwapRoute,
	priceImpactForRoute,
	exceedsPoolDepthForRoute,
	// Readouts
	effectiveRate,
	protocolFeeUsd,
	impactLevel
} from '$lib/calc';

export type {
	SlipFeeRule,
	SwapCalcResult,
	SwapHop,
	PoolDepths,
	TypedPoolDepths,
	PoolDepthMap,
	ImpactLevel
} from '$lib/calc';

/**
 * Which swap-fee rule the node charges, derived from the selected network in
 * the manner of DEPOSIT_SWAP_REFUNDS_ACTIVE in $lib/constants: a rule is 'on'
 * only once that network has passed its own PendulumSlipParityHeight.
 *
 * TESTNET is 'on': go-vsc-node #327 sets the height there, and nothing else
 * does. Quoting the final rule outright is the point of a testnet -- 'both'
 * would hide a wrong number behind a max() of the two rules.
 *
 * MAINNET is 'both': no mainnet height is scheduled, so the node still charges
 * the old rule, and 'both' quotes the higher of the two. That keeps
 * min_amount_out good on either side of a crossing, so this build is safe to
 * ship before the height and stays correct across it. Flip to 'on' once the
 * mainnet height has passed, and delete the 'off' branch a release later.
 *
 * isVscTestnet() reads the viewer's own network choice out of localStorage, so
 * ONE deployment serves both: a visitor on testnet gets 'on', everyone else
 * 'both'. It is captured at module load, like vscNetworkId itself -- switching
 * network in the UI reloads the app, which is what re-evaluates it.
 *
 * The swap arithmetic lives in `$lib/calc`, which imports nothing, so the rule
 * is INSTALLED there rather than imported from there. This is the only place
 * that decides it; `calc.slipFeeRuleInForce()` is the only place that reads it.
 */
export const SLIP_FEE_RULE: SlipFeeRule = isVscTestnet() ? 'on' : 'both';
setSlipFeeRule(SLIP_FEE_RULE);

/**
 * The pool contract stores reserves as big-endian `big.Int.Bytes()` under
 * short keys `r0` / `r1`. Fetching via `encoding: 'hex'` on `getStateByKeys`
 * returns the raw hex string; an empty / missing key serialises to `""` and
 * means zero.
 */
const KEY_RESERVE_0 = 'r0';
const KEY_RESERVE_1 = 'r1';

/** Decode a hex string from the chain-state observer back to a bigint.
 *  Accepts missing / empty / `0x`-prefixed input. */
function hexToBigInt(hex: unknown): bigint | null {
	if (hex == null) return null;
	if (typeof hex !== 'string') return null;
	const h = hex.startsWith('0x') ? hex.slice(2) : hex;
	if (h === '') return 0n;
	if (!/^[0-9a-fA-F]+$/.test(h)) return null;
	return BigInt('0x' + h);
}

/**
 * Current reserves of one pool contract. Callers resolve the contract ID
 * themselves (via `fetchPoolRegistry` or a selected pool).
 */
export async function fetchPoolDepths(poolContractId: string): Promise<PoolDepths | null> {
	if (!poolContractId) return null;
	try {
		const result = await queryOnce(new GetStateByKeysStore(), {
			variables: {
				contractId: poolContractId,
				keys: [KEY_RESERVE_0, KEY_RESERVE_1],
				encoding: 'hex'
			},
			policy: 'NetworkOnly'
		});
		const state = result.data?.getStateByKeys;
		if (!state) return null;

		const r0 = hexToBigInt(state[KEY_RESERVE_0]);
		const r1 = hexToBigInt(state[KEY_RESERVE_1]);
		if (r0 == null || r1 == null) return null;

		return { reserve0: r0, reserve1: r1 };
	} catch (err) {
		console.error('Failed to fetch pool depths', err);
		return null;
	}
}

/**
 * Look up a pool contract in the indexer registry by its asset pair
 * (order-independent). Returns the first match. Use when a caller knows the
 * assets but not the contract ID.
 */
export async function findPoolByPair(assetA: string, assetB: string): Promise<string | null> {
	const a = assetA.toUpperCase();
	const b = assetB.toUpperCase();
	try {
		const registry = await fetchPoolRegistry();
		const hit = registry.find((p) => {
			const [s0, s1] = [p.symbols[0].toUpperCase(), p.symbols[1].toUpperCase()];
			return (s0 === a && s1 === b) || (s0 === b && s1 === a);
		});
		return hit?.contractId ?? null;
	} catch (err) {
		console.error('findPoolByPair failed', err);
		return null;
	}
}

/**
 * Reserves for a pair, with the asset ordering attached.
 *
 * Chain state first (authoritative), falling back to the indexer's liquidity
 * snapshot — the chain-state path returns null for pools whose state is not
 * exposed via `getStateByKeys` on some APIs (seen on testnet BTC:HBD), and
 * without the fallback the per-user share math silently reads zero. Each
 * source gets one 500 ms retry. Null only when both failed.
 */
export async function fetchTypedPoolDepths(
	assetA: string,
	assetB: string
): Promise<TypedPoolDepths | null> {
	const registry = await fetchPoolRegistry().catch(() => []);
	const a = assetA.toLowerCase();
	const b = assetB.toLowerCase();
	const entry = registry.find((p) => {
		const s0 = p.symbols[0].toLowerCase();
		const s1 = p.symbols[1].toLowerCase();
		return (s0 === a && s1 === b) || (s0 === b && s1 === a);
	});
	if (!entry) return null;

	const asset0 = entry.symbols[0].toLowerCase();
	const asset1 = entry.symbols[1].toLowerCase();

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await queryOnce(new GetStateByKeysStore(), {
				variables: {
					contractId: entry.contractId,
					keys: [KEY_RESERVE_0, KEY_RESERVE_1],
					encoding: 'hex'
				},
				policy: 'NetworkOnly'
			});
			const state = result.data?.getStateByKeys;
			const r0 = hexToBigInt(state?.[KEY_RESERVE_0]);
			const r1 = hexToBigInt(state?.[KEY_RESERVE_1]);
			if (r0 != null && r1 != null) {
				return { contractId: entry.contractId, asset0, asset1, reserve0: r0, reserve1: r1 };
			}
			break; // state fetched OK but reserves missing → fall through to indexer
		} catch (err) {
			if (attempt === 0) {
				await sleep(500);
				continue;
			}
			console.warn('fetchTypedPoolDepths chain-state path failed, falling back to indexer', err);
		}
	}

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const snap = await fetchPoolLiquiditySnapshot(entry.contractId);
			if (!snap) return null;
			return {
				contractId: entry.contractId,
				asset0,
				asset1,
				reserve0: BigInt(Math.floor(snap.reserve0)),
				reserve1: BigInt(Math.floor(snap.reserve1))
			};
		} catch (err) {
			if (attempt === 0) {
				await sleep(500);
				continue;
			}
			console.error('fetchTypedPoolDepths indexer fallback failed after retry', err);
			return null;
		}
	}
	return null;
}

/**
 * A route from the two native pools. Kept so the native-only callers (the
 * dashboard's QuickSwap card) can stay on the two-pool signature while the
 * routing logic itself lives in one place.
 */
function nativeRoute(
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): SwapHop[] | null {
	const pools = [hiveHbdPool, btcHbdPool].filter((p): p is TypedPoolDepths => p != null);
	return buildSwapRoute(
		assetIn,
		assetOut,
		(a, b) =>
			pools.find((p) => (p.asset0 === a && p.asset1 === b) || (p.asset0 === b && p.asset1 === a)) ??
			null
	);
}

/**
 * Price impact in percent for a native pair. Prefer `priceImpactForRoute`
 * (from `$lib/calc`) for anything that can involve a custom token.
 */
export function calculatePriceImpact(
	x: bigint,
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): number {
	return priceImpactForRoute(x, nativeRoute(assetIn, assetOut, hiveHbdPool, btcHbdPool));
}

/**
 * True when `x` would be rejected on chain for exceeding half of an
 * input-side reserve. Prefer `exceedsPoolDepthForRoute` for custom tokens.
 */
export function checkExceedsPoolDepth(
	x: bigint,
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): boolean {
	return exceedsPoolDepthForRoute(x, nativeRoute(assetIn, assetOut, hiveHbdPool, btcHbdPool));
}

/**
 * Resolve the route for a pair, fetching reserves as needed. Handles every
 * pair the DEX can serve, custom tokens included, without the caller knowing
 * which pools exist. Null when the pair is not tradeable.
 */
export async function resolveSwapRoute(
	assetIn: string,
	assetOut: string
): Promise<SwapHop[] | null> {
	const aIn = assetIn?.toLowerCase();
	const aOut = assetOut?.toLowerCase();
	if (!aIn || !aOut || aIn === aOut) return null;

	const direct = await fetchTypedPoolDepths(aIn, aOut);
	if (direct) return [{ pool: direct, assetIn: aIn, assetOut: aOut }];

	if (aIn === DEX_BASE_ASSET || aOut === DEX_BASE_ASSET) return null;

	const [first, second] = await Promise.all([
		fetchTypedPoolDepths(aIn, DEX_BASE_ASSET),
		fetchTypedPoolDepths(DEX_BASE_ASSET, aOut)
	]);
	if (!first || !second) return null;
	return [
		{ pool: first, assetIn: aIn, assetOut: DEX_BASE_ASSET },
		{ pool: second, assetIn: DEX_BASE_ASSET, assetOut: aOut }
	];
}
