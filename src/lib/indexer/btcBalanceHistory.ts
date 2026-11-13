import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
import { fetchAllEventRows } from './query';

/** A signed change to one account's mapped-BTC balance, in satoshis. */
export type BtcBalanceDelta = { ts: Date; sats: number };

type TsRow = { indexer_ts: string };

/**
 * The user's mapped-BTC balance history, as a list of signed deltas.
 *
 * `getStateByKeys` takes no block height, so the mapping contract cannot be
 * read in the past the way `getAccountBalance(height:)` can. The balance is
 * therefore replayed from the contract's own event log, using exactly the
 * arithmetic the indexer's `btc_mapping_balances` view uses:
 *
 *   deposits(recipient) + transfers(to) − transfers(from) − unmaps(from)
 *
 * Verified 2026-11-13 against mainnet chain state: the replayed totals for
 * hive:v4vapp, hive:oldmans, hive:vaultec and hive:risingstarhub each match
 * the mapping contract's `a-<did>` state key exactly.
 *
 * (The view's "treat sends from the contract address as mints" carve-out only
 * concerns the contract's own row, never a user's, so it has no analogue here.)
 */
export async function fetchBtcBalanceDeltas(did: string): Promise<BtcBalanceDelta[]> {
	if (!did) return [];
	const contract = { _eq: BTC_MAPPING_CONTRACT_ID };

	const [deposits, xferIn, xferOut, unmaps] = await Promise.all([
		fetchAllEventRows<TsRow & { amount: number | string }>(
			'btc_mapping_deposit_events',
			'indexer_ts amount',
			{ indexer_contract_id: contract, recipient: { _eq: did } }
		),
		fetchAllEventRows<TsRow & { amount: number | string }>(
			'btc_mapping_transfer_events',
			'indexer_ts amount',
			{ indexer_contract_id: contract, to_addr: { _eq: did } }
		),
		fetchAllEventRows<TsRow & { amount: number | string }>(
			'btc_mapping_transfer_events',
			'indexer_ts amount',
			{ indexer_contract_id: contract, from_addr: { _eq: did } }
		),
		fetchAllEventRows<TsRow & { deducted: number | string }>(
			'btc_mapping_unmap_events',
			'indexer_ts deducted',
			{ indexer_contract_id: contract, from_addr: { _eq: did } }
		)
	]);

	const deltas: BtcBalanceDelta[] = [
		...deposits.map((r) => ({ ts: parseTs(r.indexer_ts), sats: num(r.amount) })),
		...xferIn.map((r) => ({ ts: parseTs(r.indexer_ts), sats: num(r.amount) })),
		...xferOut.map((r) => ({ ts: parseTs(r.indexer_ts), sats: -num(r.amount) })),
		...unmaps.map((r) => ({ ts: parseTs(r.indexer_ts), sats: -num(r.deducted) }))
	];
	deltas.sort((a, b) => a.ts.getTime() - b.ts.getTime());
	return deltas;
}

/**
 * Replay `deltas` onto a timeline: the balance in satoshis as of each date.
 * `dates` must be ascending.
 */
export function btcBalanceAt(deltas: BtcBalanceDelta[], dates: Date[]): number[] {
	const out = new Array<number>(dates.length).fill(0);
	let running = 0;
	let i = 0;
	for (let d = 0; d < dates.length; d++) {
		const cutoff = dates[d].getTime();
		while (i < deltas.length && deltas[i].ts.getTime() <= cutoff) running += deltas[i++].sats;
		out[d] = running;
	}
	return out;
}

/** Hasura hands back naive timestamps ("2026-11-13T21:53:48"), which `Date`
 *  would read as local time. Indexer rows are UTC, so say so explicitly. */
export function parseTs(raw: string): Date {
	const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
	return new Date(hasZone ? raw : `${raw}Z`);
}

function num(v: number | string | null | undefined): number {
	const n = typeof v === 'string' ? Number(v) : (v ?? 0);
	return Number.isFinite(n) ? n : 0;
}
