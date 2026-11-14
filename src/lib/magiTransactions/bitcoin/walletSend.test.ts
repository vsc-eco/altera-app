import { describe, it, expect, vi } from 'vitest';
import { findPendingPayment } from './walletSend';

const DEPOSIT = 'bc1qppazdrqs6vel6aq2udxcd77acqw6y5gdfqgmgnkuqp6z8u08w67qdelqcm';
const WALLET = 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('findPendingPayment (no second payment to a deposit address)', () => {
	it('finds an unconfirmed payment from the wallet to the deposit address (sorin, 11-14)', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			json([
				{
					txid: '66b1b214aa1f1dd1b38082f72b392b17025a2ec839c2d9a4c422c6134fe6d237',
					vin: [{ prevout: { scriptpubkey_address: WALLET } }],
					vout: [{ scriptpubkey_address: DEPOSIT }, { scriptpubkey_address: WALLET }]
				}
			])
		);
		expect(await findPendingPayment(DEPOSIT, WALLET, fetchImpl)).toBe(
			'66b1b214aa1f1dd1b38082f72b392b17025a2ec839c2d9a4c422c6134fe6d237'
		);
		expect(fetchImpl).toHaveBeenCalledWith(
			`https://mempool.space/api/address/${DEPOSIT}/txs/mempool`
		);
	});

	it('ignores a pending payment from someone else', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			json([
				{
					txid: 'x',
					vin: [{ prevout: { scriptpubkey_address: 'bc1qother' } }],
					vout: [{ scriptpubkey_address: DEPOSIT }]
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
			'https://mempool.space/testnet/api/address/tb1qdeposit/txs/mempool'
		);
	});
});
