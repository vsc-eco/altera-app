import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createLightningInvoice } from './v4v';
import { Network } from '../utils/sendOptions';

describe('createLightningInvoice', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				payment_hash: 'hash',
				payment_request: 'ln123',
				amount: '1000'
			})
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('uses the hive invoice endpoint for HIVE/HBD deposits', async () => {
		await createLightningInvoice(
			'1',
			'hive',
			'hive',
			Network.magi,
			{ value: { address: 'alice', did: 'did:pkh:eip155:1:0x1' } } as any,
			'alice'
		);

		const firstCall = fetchMock.mock.calls[0]?.[0];
		expect(firstCall).toBeInstanceOf(URL);
		expect((firstCall as URL).pathname).toBe('/v1/new_invoice_hive');
		expect((firstCall as URL).searchParams.get('hive_accname')).toBe('vsc.gateway');
	});

	it('uses logged-in hive account and sats currency for Magi SATS deposits', async () => {
		await createLightningInvoice(
			'1000',
			'sats',
			'sats',
			Network.magi,
			{ value: { address: 'alice', did: 'did:pkh:eip155:1:0x1' } } as any,
			'alice'
		);

		const firstCall = fetchMock.mock.calls[0]?.[0];
		expect(firstCall).toBeInstanceOf(URL);
		expect((firstCall as URL).pathname).toBe('/v1/new_invoice_hive');
		expect((firstCall as URL).searchParams.get('hive_accname')).toBe('alice');
		expect((firstCall as URL).searchParams.get('currency')).toBe('SATS');
		expect((firstCall as URL).searchParams.get('receive_currency')).toBe('magisats');
	});
});
