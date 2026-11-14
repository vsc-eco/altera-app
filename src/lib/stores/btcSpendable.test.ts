import { describe, it, expect, vi } from 'vitest';
import {
	spendableSats,
	feeReserveSats,
	maxSendableSats,
	fetchBtcFeeReserve,
	FALLBACK_FEE_RATE
} from './btcSpendable';

describe('btcSpendable', () => {
	it("excludes unconfirmed change: sorin's wallet after its pending payment (11-14)", () => {
		// 13,570 confirmed, all spent by a pending payment returning 1,724 change.
		const stats = {
			chain_stats: { funded_txo_sum: 13_570, spent_txo_sum: 0 },
			mempool_stats: { funded_txo_sum: 1_724, spent_txo_sum: 13_570 }
		};
		expect(spendableSats(stats)).toBe(0); // Leather showed Available $0.00
		expect(spendableSats({ chain_stats: { funded_txo_sum: 13_570, spent_txo_sum: 0 } })).toBe(
			13_570
		);
	});

	it('leaves room for the miner fee', () => {
		expect(feeReserveSats(5)).toBe(1_000);
		expect(feeReserveSats(0)).toBe(FALLBACK_FEE_RATE * 200);
		expect(feeReserveSats(NaN)).toBe(FALLBACK_FEE_RATE * 200);
		expect(maxSendableSats(13_570, 1_000)).toBe(12_570);
		expect(maxSendableSats(500, 1_000)).toBe(0);
	});

	it('reads the half-hour fee rate and falls back on failure', async () => {
		const ok = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ halfHourFee: 4 }), { status: 200 }));
		expect(await fetchBtcFeeReserve(false, ok)).toBe(800);
		expect(ok).toHaveBeenCalledWith('https://mempool.space/api/v1/fees/recommended');
		expect(await fetchBtcFeeReserve(false, vi.fn().mockRejectedValue(new Error('down')))).toBe(
			FALLBACK_FEE_RATE * 200
		);
	});
});
