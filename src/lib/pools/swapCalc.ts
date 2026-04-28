/**
 * Swap fee and output calculations using BigInt integer math.
 *
 * All amounts are in smallest units (3 decimal places for HIVE/HBD,
 * i.e. 1.000 HIVE = 1000).
 *
 * Fees are denominated in the OUTPUT asset: the full `x` enters the
 * pool, the constant-product invariant produces a gross output, and
 * fees are carved off that.
 *
 * Formulas (mirror the on-chain Go contract):
 *   grossOut  = Y - (X * Y) / (X + x)
 *   base fee  = grossOut * feeBps / 10000        (output units, floor 1)
 *   CLP fee   = (x^2 * Y) / (x + X)^2            (output units, floor 1)
 *   total fee = base fee + CLP fee
 *   amountOut = grossOut - base fee - CLP fee
 *   min_amount_out = amountOut * (10000 - slippageBps) / 10000
 */

import { GetStateByKeysStore } from '$houdini';
import { fetchPoolRegistry, fetchPoolLiquiditySnapshot } from './poolsData';

/**
 * The pool contract stores reserves as big-endian `big.Int.Bytes()` under
 * short keys `r0` / `r1`. Fetching via `encoding: 'hex'` on
 * `getStateByKeys` returns the raw hex string; an empty/missing key
 * serialises to `""` and means zero.
 */
const KEY_RESERVE_0 = 'r0';
const KEY_RESERVE_1 = 'r1';

/** Decode a hex string returned by the chain-state observer back to
 *  bigint. Accepts missing / empty / `"0x"`-prefixed inputs. */
function hexToBigInt(hex: unknown): bigint | null {
	if (hex == null) return null;
	if (typeof hex !== 'string') return null;
	const h = hex.startsWith('0x') ? hex.slice(2) : hex;
	if (h === '') return 0n;
	if (!/^[0-9a-fA-F]+$/.test(h)) return null;
	return BigInt('0x' + h);
}

export interface PoolDepths {
	reserve0: bigint; // HIVE reserve (smallest units) — legacy, HIVE/HBD only
	reserve1: bigint; // HBD reserve (smallest units) — legacy, HIVE/HBD only
}

/** Pool depths with explicit asset ordering so the same struct can
 *  represent any pair (HIVE/HBD, BTC/HBD, …). `asset0` / `asset1` are
 *  lowercase asset names ("hive", "hbd", "btc"). */
export interface TypedPoolDepths {
	contractId: string;
	asset0: string;
	asset1: string;
	reserve0: bigint;
	reserve1: bigint;
}

export type PoolDepthMap = Record<string, TypedPoolDepths>;

export interface SwapCalcResult {
	baseFee: bigint;
	clpFee: bigint;
	totalFee: bigint;
	expectedOutput: bigint;
	minAmountOut: bigint;
	slippageBps: number; // basis points (e.g. 100 = 1%)
	/** Set on two-hop swaps. Hop1 takes its fees in the intermediate
	 *  asset (e.g. HBD), separately from the top-level fee fields which
	 *  always represent the final hop in the output asset. */
	hop1Fee?: {
		asset: string;
		baseFee: bigint;
		clpFee: bigint;
		totalFee: bigint;
	};
}

/**
 * Fetch current pool reserves from the VSC GraphQL endpoint for a specific
 * pool contract. Callers are responsible for resolving the right contract ID
 * (e.g. via `fetchPoolRegistry` or a selected pool).
 */
export async function fetchPoolDepths(
	poolContractId: string
): Promise<PoolDepths | null> {
	if (!poolContractId) return null;
	try {
		const result = await new GetStateByKeysStore().fetch({
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
 * (order-independent). Returns the first matching pool. Use when callers
 * only know the assets, not the contract ID directly.
 */
export async function findPoolByPair(
	assetA: string,
	assetB: string
): Promise<string | null> {
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
 * Calculate swap fees and expected output using pure integer arithmetic.
 *
 * @param x         Input amount (smallest units)
 * @param X         Reserve of input asset (smallest units)
 * @param Y         Reserve of output asset (smallest units)
 * @param slippageBps  Slippage tolerance in basis points (e.g. 100 = 1%)
 */
export function calculateSwap(
	x: bigint,
	X: bigint,
	Y: bigint,
	slippageBps: number
): SwapCalcResult {
	if (x <= 0n || X <= 0n || Y <= 0n) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps
		};
	}

	// grossOut = Y - (X * Y) / (X + x)  — constant-product invariant, pre-fee
	const newX = X + x;
	const grossOut = Y - (X * Y) / newX;

	// base fee = grossOut * 8 / 10000  (output units, floor 1 to match contract)
	let baseFee = (grossOut * 8n) / 10000n;
	if (baseFee === 0n) baseFee = 1n;

	// CLP fee = (x^2 * Y) / (x + X)^2  (output units, floor 1)
	let clpFee = (x * x * Y) / (newX * newX);
	if (clpFee === 0n) clpFee = 1n;

	const totalFee = baseFee + clpFee;

	// amountOut = grossOut - baseFee - clpFee
	let expectedOutput = grossOut - baseFee - clpFee;
	if (expectedOutput < 0n) {
		expectedOutput = 0n;
	}

	// min_amount_out = expectedOutput * (10000 - slippageBps) / 10000
	const slipBps = BigInt(Math.max(0, Math.min(slippageBps, 10000)));
	const minAmountOut = (expectedOutput * (10000n - slipBps)) / 10000n;

	return {
		baseFee,
		clpFee,
		totalFee,
		expectedOutput,
		minAmountOut,
		slippageBps
	};
}

/**
 * Determine pool reserves (X, Y) based on which asset is input.
 * reserve0 = HIVE, reserve1 = HBD.
 * If swapping HIVE->HBD: X=reserve0, Y=reserve1
 * If swapping HBD->HIVE: X=reserve1, Y=reserve0
 */
export function getOrderedDepths(
	depths: PoolDepths,
	assetIn: 'hive' | 'hbd'
): { X: bigint; Y: bigint } {
	if (assetIn === 'hive') {
		return { X: depths.reserve0, Y: depths.reserve1 };
	}
	return { X: depths.reserve1, Y: depths.reserve0 };
}

/**
 * Generalized version of `getOrderedDepths` that works for any pool
 * regardless of alphabetical asset ordering. Returns `{X, Y}` with X
 * = reserve of `assetIn`, Y = reserve of the other asset, or null if
 * the pool doesn't contain `assetIn`.
 */
export function getOrderedDepthsFor(
	depths: TypedPoolDepths,
	assetIn: string
): { X: bigint; Y: bigint } | null {
	const a = assetIn.toLowerCase();
	if (depths.asset0 === a) return { X: depths.reserve0, Y: depths.reserve1 };
	if (depths.asset1 === a) return { X: depths.reserve1, Y: depths.reserve0 };
	return null;
}

/**
 * Fetch depths for a single pool identified by its asset pair. Uses
 * chain state first (GetStateByKeysStore) and falls back to the
 * indexer's `dex_pool_liquidity` snapshot when chain state returns
 * null — some pools (observed on testnet BTC:HBD) aren't exposed
 * through the observer API so the indexer snapshot is our only
 * source of truth for reserves on those.
 *
 * Each network path retries once after 500 ms on a thrown error so a
 * transient indexer timeout doesn't look like a missing pool to the
 * caller. Returns null only if the pool isn't in the registry OR if
 * both attempts at both sources failed / returned unusable numbers.
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

	// Try chain state first, with one 500 ms retry on transient failure.
	// Pool contract stores reserves under short keys `r0` / `r1` as raw
	// big-endian big.Int bytes; request with `encoding: 'hex'` so the
	// GraphQL layer doesn't mangle high bytes through UTF-8.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await new GetStateByKeysStore().fetch({
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
				return {
					contractId: entry.contractId,
					asset0,
					asset1,
					reserve0: r0,
					reserve1: r1
				};
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

	// Indexer snapshot fallback, also with one retry.
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
 * Returns true when the input amount `x` would be rejected on-chain because
 * it exceeds 50 % of the input-side reserve in one or both hops.
 *
 * The contract hard-rejects any swap where the input is greater than half the
 * pool's input reserve (i.e. `x * 2 > X`). For two-hop routes we also check
 * the intermediate output against the second pool's input reserve.
 *
 * All amounts are in smallest units. Asset names are lowercase strings.
 */
export function checkExceedsPoolDepth(
	x: bigint,
	assetIn: string,
	assetOut: string,
	hiveHbdPool: TypedPoolDepths | null,
	btcHbdPool: TypedPoolDepths | null
): boolean {
	if (x <= 0n) return false;

	const aIn = assetIn.toLowerCase();
	const aOut = assetOut.toLowerCase();
	const involvesBtc = aIn === 'btc' || aOut === 'btc';

	if (!involvesBtc) {
		// Single-hop: HIVE ↔ HBD
		if (!hiveHbdPool) return false;
		const d = getOrderedDepthsFor(hiveHbdPool, aIn);
		return !!d && x * 2n > d.X;
	}

	if ((aIn === 'btc' && aOut === 'hbd') || (aIn === 'hbd' && aOut === 'btc')) {
		// Single-hop: BTC ↔ HBD
		if (!btcHbdPool) return false;
		const d = getOrderedDepthsFor(btcHbdPool, aIn);
		return !!d && x * 2n > d.X;
	}

	// Two-hop: BTC ↔ HIVE via HBD
	if (!btcHbdPool || !hiveHbdPool) return false;
	const pool1 = aIn === 'btc' ? btcHbdPool : hiveHbdPool;
	const pool2 = aIn === 'btc' ? hiveHbdPool : btcHbdPool;
	const d1 = getOrderedDepthsFor(pool1, aIn);
	if (!d1) return false;
	// Check hop1 input against pool1 input reserve
	if (x * 2n > d1.X) return true;
	// Estimate intermediate output (net of fees) and check against pool2 input reserve
	const d2 = getOrderedDepthsFor(pool2, 'hbd');
	if (!d2) return false;
	const hop1Out = calculateSwap(x, d1.X, d1.Y, 0).expectedOutput;
	return hop1Out * 2n > d2.X;
}

/**
 * Execute a two-hop swap calc: input → hopAsset (in pool1) →
 * output (in pool2). Fees accumulate from both hops. Slippage is
 * applied only to the FINAL output, which matches the router's
 * behavior (each hop runs at live price, the slippage guard fires
 * only on the final receive amount).
 */
export function calculateTwoHopSwap(
	x: bigint,
	pool1: TypedPoolDepths,
	pool2: TypedPoolDepths,
	assetIn: string,
	hopAsset: string,
	assetOut: string,
	slippageBps: number
): SwapCalcResult {
	const hop1Depths = getOrderedDepthsFor(pool1, assetIn);
	if (!hop1Depths) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps
		};
	}
	// First hop runs at its own pool and produces an intermediate amount.
	const hop1 = calculateSwap(x, hop1Depths.X, hop1Depths.Y, 0);
	const hop1Fee = {
		asset: hopAsset,
		baseFee: hop1.baseFee,
		clpFee: hop1.clpFee,
		totalFee: hop1.totalFee
	};
	if (hop1.expectedOutput <= 0n) {
		return { ...hop1, slippageBps, hop1Fee };
	}

	const hop2Depths = getOrderedDepthsFor(pool2, hopAsset);
	if (!hop2Depths) {
		return {
			baseFee: 0n,
			clpFee: 0n,
			totalFee: 0n,
			expectedOutput: 0n,
			minAmountOut: 0n,
			slippageBps,
			hop1Fee
		};
	}
	const hop2 = calculateSwap(hop1.expectedOutput, hop2Depths.X, hop2Depths.Y, slippageBps);

	// Fees are output-denominated at each hop: hop1 fees are in `hopAsset`,
	// hop2 fees are in `assetOut`. The top-level fee fields hold hop2 (in
	// `assetOut`); `hop1Fee` carries hop1's separately so callers can
	// render "<hop1Total> <hopAsset> and <hop2Total> <assetOut>".
	return {
		baseFee: hop2.baseFee,
		clpFee: hop2.clpFee,
		totalFee: hop2.totalFee,
		expectedOutput: hop2.expectedOutput,
		minAmountOut: hop2.minAmountOut,
		slippageBps,
		hop1Fee
	};
}
