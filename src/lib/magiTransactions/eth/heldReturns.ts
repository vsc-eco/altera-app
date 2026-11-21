/**
 * Payouts that came back from Ethereum and are held for their sender.
 *
 * A swap's payout on Ethereum that fails (it reverted, it was dropped, or its
 * sender cancelled it while it waited) goes back to the sender: swapped back to
 * the asset it was paid with and sent to the sender's own chain (HIVE/HBD on
 * Hive, BTC on Bitcoin). When that swap back cannot run yet (the price moved
 * more than 5% against it, or no pool takes it), the EVM bridge holds the value
 * for the sender (account-mapping PAYOUT-1, never a Magi balance) and the
 * bridge's keeper retries it with the same floor. The sender can also take it
 * back now at today's price, or have the held asset itself sent to an Ethereum
 * address (the exit when no pool can take it back).
 *
 * Only the bridge's bot swaps a held return back (at today's price, never below
 * the swap's own rate less 5% for the first day), so nobody can skim it.
 *
 * Records: "phr-<id>" (JSON {t, a, d, ra, m, h}) for ids from "phrh" to "phrt".
 */
import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { calculateRouteSwap, resolveSwapRoute } from '$lib/pools/swapCalc';

export type HeldReturn = {
	id: number;
	/** The sender it is held for (hive:<name> or did:pkh:bip122:...). */
	to: string;
	/** What is held: 'eth' or 'usdc'. */
	asset: string;
	/** In the held asset's smallest units. */
	amount: bigint;
	/** What it goes back as: 'hive', 'hbd' or 'btc'. */
	returnAsset: string;
	/** The least the bot's swap back gives for its first day (smallest units of returnAsset). */
	floor: bigint;
	/** When it was held (unix seconds; 0 when unknown). */
	heldAt: number;
};

/** Ids read per state query. */
const CHUNK = 64;
/**
 * The most ids read past the head. The head moves only past finished returns,
 * so returns nobody can take back yet (a floor the price has not met) stay in
 * front of newer ones: reading only the first chunk would hide a later
 * sender's return.
 */
const MAX_SCAN = 1024;

/**
 * An amount in smallest units as a decimal string, exact (a JS number loses
 * ETH's wei past 2^53) and without trailing zeros: 24104039262343843n, 18 ->
 * "0.024104039262343843"; 3409600n, 6 -> "3.4096".
 */
export function formatUnitsExact(amount: bigint, decimals: number): string {
	const neg = amount < 0n;
	const s = (neg ? -amount : amount).toString().padStart(decimals + 1, '0');
	const int = s.slice(0, s.length - decimals);
	const frac = s.slice(s.length - decimals).replace(/0+$/, '');
	return `${neg ? '-' : ''}${int}${frac ? '.' + frac : ''}`;
}

/** Parse one record (exported for tests); null when it is not one. */
export function parseHeldReturn(id: number, raw: string | null | undefined): HeldReturn | null {
	if (!raw) return null;
	try {
		const r = JSON.parse(raw) as {
			t?: string;
			a?: string;
			d?: number | string;
			ra?: string;
			m?: number | string;
			r?: string;
			s?: number;
			h?: number;
		};
		if (!r.t || !r.a || r.d === undefined || !r.ra) return null;
		return {
			id,
			to: r.t,
			asset: r.a,
			amount: BigInt(String(r.d)),
			returnAsset: r.ra,
			floor: BigInt(String(r.m ?? 0)),
			heldAt: Number(r.h ?? 0) || 0
		};
	} catch {
		return null;
	}
}

async function readState(keys: string[]): Promise<Record<string, string | null>> {
	const res = await queryOnce(new GetStateByKeysStore(), {
		variables: { contractId: EVM_BRIDGE_CONTRACT_ID, keys },
		policy: 'NetworkOnly'
	});
	return (res.data?.getStateByKeys ?? {}) as Record<string, string | null>;
}

/** The returns held for `did` (empty on any read error). */
export async function fetchHeldReturns(did: string): Promise<HeldReturn[]> {
	if (!EVM_BRIDGE_CONTRACT_ID || !did) return [];
	try {
		const bounds = await readState(['phrh', 'phrt']);
		const head = Number(bounds['phrh'] ?? 0) || 0;
		const tail = Number(bounds['phrt'] ?? 0) || 0;
		if (tail <= head) return [];
		const end = Math.min(tail, head + MAX_SCAN);
		const out: HeldReturn[] = [];
		for (let from = head; from < end; from += CHUNK) {
			const ids: number[] = [];
			for (let id = from; id < Math.min(end, from + CHUNK); id++) ids.push(id);
			const recs = await readState(ids.map((id) => `phr-${id}`));
			for (const id of ids) {
				const r = parseHeldReturn(id, recs[`phr-${id}`]);
				if (r && r.to === did) out.push(r);
			}
		}
		return out;
	} catch (err) {
		console.error('held returns: state read failed', err);
		return [];
	}
}

/**
 * Today's least output for taking a held return back now: the current route
 * quote less `slippageBps` (the user's own price, as on any swap). null when
 * no route prices it.
 */
export async function heldReturnMinOut(r: HeldReturn, slippageBps = 100): Promise<bigint | null> {
	const route = await resolveSwapRoute(r.asset, r.returnAsset);
	if (!route) return null;
	const q = calculateRouteSwap(r.amount, route, slippageBps);
	return q.minAmountOut > 0n ? q.minAmountOut : null;
}

/** The bridge call that releases a held return (to Hive/Bitcoin at minOut, or to an Ethereum address). */
export function releaseHeldReturnCall(
	id: number,
	release: { minOut: bigint } | { toEthAddress: string }
): { contract_id: string; action: 'releasePayoutReturn'; payload: string } {
	const payload =
		'minOut' in release
			? { id, min_out: release.minOut.toString() }
			: { id, to: release.toEthAddress };
	return {
		contract_id: EVM_BRIDGE_CONTRACT_ID,
		action: 'releasePayoutReturn',
		payload: JSON.stringify(payload)
	};
}
