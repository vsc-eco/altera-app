import { describe, it, expect, vi } from 'vitest';
import {
	buildBtcSwapInstruction,
	btcAddressNetwork,
	requestBtcSwapDepositAddress,
	hiveAccountExists
} from './swapDeposit';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { BTC_MAINNET_CAIP } from '$lib/auth/btcCaip';

const BTC_ADDR = 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';

/** The instruction the QuickSwap card builds for a Hive-settled output (QuickSwap.svelte requestSwap). */
function quickSwapInstruction(receiver: string, toAsset: string) {
	const normalized = receiver.startsWith('hive:')
		? receiver
		: receiver.startsWith('@')
			? `hive:${receiver.slice(1)}`
			: `hive:${receiver}`;
	const chainMap: Record<string, string> = { hive: 'HIVE', hbd: 'HIVE', btc: 'BTC' };
	return new URLSearchParams({
		swap_to: normalized,
		swap_asset_out: toAsset,
		destination_chain: chainMap[toAsset] ?? 'MAGI'
	}).toString();
}

describe('buildBtcSwapInstruction', () => {
	it.each(['innopay', '@innopay', 'hive:innopay', '  innopay  '])(
		'settles on Hive like QuickSwap for receiver %j',
		(recipient) => {
			for (const coin of [Coin.hbd, Coin.hive]) {
				const r = buildBtcSwapInstruction({
					recipient,
					toCoin: coin.value,
					toNetwork: Network.hiveMainnet.value
				});
				expect(r).toEqual({
					ok: true,
					recipient: 'hive:innopay',
					instruction: quickSwapInstruction(recipient.trim(), coin.value)
				});
			}
		}
	);

	it('pins the exact Hive instruction string', () => {
		const r = buildBtcSwapInstruction({
			recipient: 'innopay',
			toCoin: Coin.hbd.value,
			toNetwork: Network.hiveMainnet.value
		});
		expect(r.ok && r.instruction).toBe(
			'swap_to=hive%3Ainnopay&swap_asset_out=hbd&destination_chain=HIVE'
		);
	});

	it("keeps the output on Magi for the sender's own BTC address (no destination_chain)", () => {
		const r = buildBtcSwapInstruction({
			recipient: BTC_ADDR,
			toCoin: Coin.hbd.value,
			toNetwork: Network.magi.value
		});
		const did = `did:pkh:bip122:${BTC_MAINNET_CAIP}:${BTC_ADDR}`;
		expect(r).toEqual({
			ok: true,
			recipient: did,
			instruction: new URLSearchParams({ swap_to: did, swap_asset_out: 'hbd' }).toString()
		});
	});

	it('passes a DID through and accepts a Hive account on Magi', () => {
		const did = `did:pkh:bip122:${BTC_MAINNET_CAIP}:${BTC_ADDR}`;
		const a = buildBtcSwapInstruction({ recipient: did, toCoin: 'hive', toNetwork: 'magi' });
		expect(a.ok && a.recipient).toBe(did);
		const b = buildBtcSwapInstruction({ recipient: 'innopay', toCoin: 'hive', toNetwork: 'magi' });
		expect(b.ok && b.instruction).toBe('swap_to=hive%3Ainnopay&swap_asset_out=hive');
	});

	it('refuses a non-Hive receiver for a Hive payout', () => {
		const r = buildBtcSwapInstruction({
			recipient: BTC_ADDR,
			toCoin: Coin.hbd.value,
			toNetwork: Network.hiveMainnet.value
		});
		expect(r).toEqual({ ok: false, error: 'Enter a Hive account to receive on Hive.' });
	});

	it('refuses BTC as the output and any destination other than Magi or Hive', () => {
		expect(
			buildBtcSwapInstruction({ recipient: 'innopay', toCoin: 'btc', toNetwork: 'magi' }).ok
		).toBe(false);
		expect(
			buildBtcSwapInstruction({
				recipient: BTC_ADDR,
				toCoin: 'hbd',
				toNetwork: Network.btcMainnet.value
			}).ok
		).toBe(false);
	});

	it('refuses an empty or unreadable receiver', () => {
		for (const recipient of [undefined, '', '   ', '@']) {
			expect(
				buildBtcSwapInstruction({ recipient, toCoin: 'hbd', toNetwork: 'hive_mainnet' })
			).toEqual({ ok: false, error: 'Enter a receiver.' });
		}
		const r = buildBtcSwapInstruction({
			recipient: 'not-a-name-or-an-address-at-all',
			toCoin: 'hbd',
			toNetwork: 'magi'
		});
		expect(r.ok).toBe(false);
	});
});

describe('requestBtcSwapDepositAddress', () => {
	const okResponse = (body: unknown) =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});

	it('posts the instruction and network to the same-origin proxy and returns the address', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(okResponse({ address: 'bc1qdeposit', raw: 'x' }));
		const address = await requestBtcSwapDepositAddress('swap_to=hive%3Aa', 'mainnet', fetchImpl);
		expect(address).toBe('bc1qdeposit');
		expect(fetchImpl).toHaveBeenCalledWith('/api/mapping-bot', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ instruction: 'swap_to=hive%3Aa', network: 'mainnet' })
		});
	});

	it('throws the proxy status and text on an error', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('upstream down', { status: 502 }));
		await expect(requestBtcSwapDepositAddress('i', 'testnet', fetchImpl)).rejects.toThrow(
			'Mapping bot error (502): upstream down'
		);
	});

	it('throws when the proxy returns no address', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(okResponse({}));
		await expect(requestBtcSwapDepositAddress('i', 'mainnet', fetchImpl)).rejects.toThrow(
			'Mapping bot returned no address'
		);
	});
});

describe('deposit-swap refunds (refund_to, min_amount_out, minimum)', () => {
	const base = {
		recipient: 'innopay',
		toCoin: 'hbd',
		toNetwork: 'hive_mainnet',
		amountSats: 11_600
	};

	it('adds nothing while refunds are not active (contract not upgraded)', () => {
		const r = buildBtcSwapInstruction({
			...base,
			refundTo: 'hive:sender',
			minAmountOut: '7900',
			refundsActive: false
		});
		expect(r.ok && r.instruction).toBe(
			'swap_to=hive%3Ainnopay&swap_asset_out=hbd&destination_chain=HIVE'
		);
	});

	it("carries the sender's refund_to and the min once active", () => {
		const btc = buildBtcSwapInstruction({
			...base,
			refundTo: 'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5',
			minAmountOut: '7900',
			refundsActive: true
		});
		expect(btc.ok && btc.instruction).toBe(
			'swap_to=hive%3Ainnopay&swap_asset_out=hbd&destination_chain=HIVE&refund_to=bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5&min_amount_out=7900'
		);
		const hive = buildBtcSwapInstruction({
			...base,
			refundTo: 'hive:sender',
			minAmountOut: '7900',
			refundsActive: true
		});
		expect(hive.ok && hive.instruction).toBe(
			'swap_to=hive%3Ainnopay&swap_asset_out=hbd&destination_chain=HIVE&refund_to=hive%3Asender&min_amount_out=7900'
		);
	});

	it('refuses to issue an address without a quote minimum once active', () => {
		for (const minAmountOut of [undefined, '', '0', '000', '12.5', 'abc', '-5']) {
			const r = buildBtcSwapInstruction({
				...base,
				refundTo: 'hive:sender',
				minAmountOut,
				refundsActive: true
			});
			expect(r.ok, String(minAmountOut)).toBe(false);
		}
		// While refunds are off nothing changes: no min is sent, as today.
		expect(buildBtcSwapInstruction({ ...base, refundsActive: false }).ok).toBe(true);
	});

	it('refuses without a refund target once active (an EVM-only login)', () => {
		const r = buildBtcSwapInstruction({
			...base,
			refundTo: 'did:pkh:eip155:1:0xabc',
			refundsActive: true
		});
		expect(r.ok).toBe(false);
		expect(buildBtcSwapInstruction({ ...base, refundsActive: true }).ok).toBe(false);
	});

	it('refuses a swap too small to refund on Bitcoin', () => {
		const r = buildBtcSwapInstruction({ ...base, amountSats: 9_999 });
		expect(r).toEqual({
			ok: false,
			error:
				'A swap paid with Bitcoin needs at least 0.0001 BTC, so a refund can always cover its network fee.'
		});
		expect(buildBtcSwapInstruction({ ...base, amountSats: 10_000 }).ok).toBe(true);
	});

	it('checks a Hive payout account exists', async () => {
		expect(await hiveAccountExists('hive:innopay', async () => [{ name: 'innopay' }])).toBe(true);
		expect(await hiveAccountExists('@nobody-here', async () => [])).toBe(false);
		await expect(
			hiveAccountExists('x', async () => {
				throw new Error('down');
			})
		).rejects.toThrow('down');
	});
});

describe('btcAddressNetwork (a refund address is really one, on the right network)', () => {
	it('names the network of each address form', () => {
		for (const [addr, want] of [
			['bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5', 'mainnet'],
			['BC1QF87MYTRP3DJ9SM2Y2YENSJ3G454N3P6K2T6SR5', 'mainnet'],
			['1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'mainnet'],
			['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'mainnet'],
			['tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'testnet'],
			['bcrt1q4h7w2n6jnvs4fc7rvxa78a75rkcxx4ch44jl8m', 'testnet'],
			['mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn', 'testnet'],
			['2N9hLwkSqr1cPQAPxbrGVUjxyjD11G2e1he', 'testnet']
		] as const) {
			expect(btcAddressNetwork(addr), addr).toBe(want);
		}
	});

	it('refuses what only LOOKS like one', () => {
		for (const addr of [
			'',
			undefined,
			'nonsense', // a leading-character test accepted this: 'n' is a testnet prefix
			'manual',
			'3',
			'1',
			'2',
			'bc1qshort', // too short for bech32
			'bC1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5', // mixed case is invalid bech32
			'bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5b1o', // 'b','1','o' are not bech32 data
			'0BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', // no base58 version byte
			'1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN0', // '0' is not base58
			'hive:sender',
			'did:pkh:eip155:1:0xabc'
		]) {
			expect(btcAddressNetwork(addr), String(addr)).toBeNull();
		}
	});
});

describe('a refund address on the wrong network is caught here, not at the bot', () => {
	const base = {
		recipient: 'hive:innopay',
		toCoin: Coin.hbd.value,
		toNetwork: Network.hiveMainnet.value,
		amountSats: 20_000,
		minAmountOut: '7900',
		refundsActive: true
	};

	it('refuses a testnet refund address on mainnet, and the reverse', () => {
		const onMainnet = buildBtcSwapInstruction({
			...base,
			refundTo: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
			testnet: false
		});
		expect(onMainnet).toEqual({
			ok: false,
			error: 'That refund address is for Bitcoin testnet, but this swap is on mainnet.'
		});
		const onTestnet = buildBtcSwapInstruction({ ...base, refundTo: BTC_ADDR, testnet: true });
		expect(onTestnet).toEqual({
			ok: false,
			error: 'That refund address is for Bitcoin mainnet, but this swap is on testnet.'
		});
	});

	it('accepts the matching network, and a hive: refund on either', () => {
		expect(buildBtcSwapInstruction({ ...base, refundTo: BTC_ADDR, testnet: false }).ok).toBe(true);
		expect(
			buildBtcSwapInstruction({
				...base,
				refundTo: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
				testnet: true
			}).ok
		).toBe(true);
		expect(buildBtcSwapInstruction({ ...base, refundTo: 'hive:sender', testnet: true }).ok).toBe(
			true
		);
	});
});
