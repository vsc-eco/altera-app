import { writable } from 'svelte/store';

/**
 * What a Bitcoin wallet can send now, and how much of it the miner fee needs.
 *
 * A wallet (Leather by default) spends confirmed coins only: unconfirmed change
 * from its own pending payment is not spendable yet. And a send has to leave
 * room for its miner fee: a request for the whole balance fails in the wallet
 * ("InsufficientFunds", Leather crashed on it 11-14).
 */

export type MempoolAddressStats = {
	chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
	mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
};

/** Confirmed coins less what pending payments already spend, in sats. */
export function spendableSats(stats: MempoolAddressStats): number {
	const confirmed =
		(stats.chain_stats?.funded_txo_sum ?? 0) - (stats.chain_stats?.spent_txo_sum ?? 0);
	const pendingOut = stats.mempool_stats?.spent_txo_sum ?? 0;
	return Math.max(0, confirmed - pendingOut);
}

/** vbytes held back for a send's fee: a two-input, two-output P2WPKH payment with margin. */
export const BTC_SEND_FEE_VBYTES = 200;
/** Used when the fee feed cannot be read: never block a send on it. */
export const FALLBACK_FEE_RATE = 10;

export function feeReserveSats(feeRate: number): number {
	const rate = Number.isFinite(feeRate) && feeRate >= 1 ? feeRate : FALLBACK_FEE_RATE;
	return Math.ceil(rate * BTC_SEND_FEE_VBYTES);
}

/** The most a wallet can send now: spendable less the fee reserve. */
export function maxSendableSats(spendable: number, reserve: number): number {
	return Math.max(0, spendable - reserve);
}

/** Sats held back for the miner fee of a BTC send from the connected wallet. */
export const btcSendFeeReserve = writable<number>(feeReserveSats(FALLBACK_FEE_RATE));

/** Reads mempool.space's half-hour fee rate; falls back on any failure. */
export async function fetchBtcFeeReserve(
	testnet: boolean,
	fetchImpl: typeof fetch = fetch
): Promise<number> {
	try {
		const base = testnet ? 'https://mempool.space/testnet/api' : 'https://mempool.space/api';
		const res = await fetchImpl(`${base}/v1/fees/recommended`);
		if (!res.ok) return feeReserveSats(FALLBACK_FEE_RATE);
		const fees = (await res.json()) as { halfHourFee?: number };
		return feeReserveSats(Number(fees.halfHourFee));
	} catch {
		return feeReserveSats(FALLBACK_FEE_RATE);
	}
}
