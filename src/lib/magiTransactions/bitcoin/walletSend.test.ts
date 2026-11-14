import { describe, it, expect, vi } from 'vitest';
import { findPendingPayment } from './walletSend';

const DEPOSIT = 'bc1qppazdrqs6vel6aq2udxcd77acqw6y5gdfqgmgnkuqp6z8u08w67qdelqcm';
const WALLET = 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';
const TXID = '66b1b214aa1f1dd1b38082f72b392b17025a2ec839c2d9a4c422c6134fe6d237';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const payment = (confirmed: boolean | undefined, from = WALLET) => ({
	txid: TXID,
	...(confirmed === undefined ? {} : { status: { confirmed } }),
	vin: [{ prevout: { scriptpubkey_address: from } }],
	vout: [{ scriptpubkey_address: DEPOSIT }, { scriptpubkey_address: WALLET }]
});

describe('findPendingPayment (no second payment to a deposit address)', () => {
	it('finds an unconfirmed payment from the wallet to the deposit address (sorin, 11-14)', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(json([payment(false)]));
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toEqual({
			txid: TXID,
			confirmed: false
		});
		expect(fetchImpl).toHaveBeenCalledWith(`https://mempool.space/api/address/${DEPOSIT}/txs`);
	});

	it('also finds one that has ALREADY CONFIRMED but is not swapped yet', async () => {
		// The gap the mempool-only lookup left: once the payment confirms it
		// leaves the mempool, and a second send was possible until the swap ran.
		const fetchImpl = vi.fn().mockResolvedValue(json([payment(true)]));
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toEqual({
			txid: TXID,
			confirmed: true
		});
	});

	it('treats a missing status as unconfirmed rather than missing the payment', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(json([payment(undefined)]));
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toEqual({
			txid: TXID,
			confirmed: false
		});
	});

	it('ignores a payment from someone else', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(json([payment(false, 'bc1qother')]));
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toBeNull();
	});

	it('ignores a transaction of ours that does not pay the deposit address', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			json([
				{
					txid: TXID,
					status: { confirmed: false },
					vin: [{ prevout: { scriptpubkey_address: WALLET } }],
					vout: [{ scriptpubkey_address: WALLET }]
				}
			])
		);
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toBeNull();
	});

	it('fails open: a lookup error never blocks a send', async () => {
		expect(
			await findPendingPayment(DEPOSIT, WALLET, vi.fn().mockRejectedValue(new Error('down')))
		).toBeNull();
		expect(
			await findPendingPayment(DEPOSIT, WALLET, vi.fn().mockResolvedValue(json({}, 503)))
		).toBeNull();
	});

	it('uses the testnet API for a testnet deposit address', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(json([]));
		await findPendingPayment('tb1qdeposit', 'tb1qwallet', fetchImpl);
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://mempool.space/testnet/api/address/tb1qdeposit/txs'
		);
	});
});
