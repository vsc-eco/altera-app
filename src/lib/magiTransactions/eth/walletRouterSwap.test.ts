import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
import {
	SWAP_CONTRACT_ID,
	SWAP_NEEDS_QUOTE_MESSAGE,
	getHiveSwapOp,
	hasQuoteMinimum
} from '../hive/vscOperations/swap';

const fetchAccountRc = vi.fn();
const fetchBtcPayoutSwapMinRc = vi.fn();
vi.mock('../hive/vscOperations/rcSizing', async (importOriginal) => ({
	...(await importOriginal<typeof import('../hive/vscOperations/rcSizing')>()),
	fetchAccountRc: (did: string) => fetchAccountRc(did),
	fetchBtcPayoutSwapMinRc: () => fetchBtcPayoutSwapMinRc()
}));

const {
	buildWalletRouterSwapOps,
	prepareWalletRouterSwap,
	walletRouterSwapInstruction,
	walletSwapFromMagi
} = await import('./walletRouterSwap');
const { BTC_PAYOUT_EVM_INPUT_EXTRA_RC, BTC_PAYOUT_SWAP_MIN_RC, BTC_PAYOUT_SWAP_MIN_RC_V0_15 } =
	await import('../hive/vscOperations/rcSizing');

const EVM = 'did:pkh:eip155:1:0x00000000000000000000000000000000000000a1';
const LEATHER =
	'did:pkh:bip122:000000000019d6689c085ae165831e93:bc1qf87mytrp3dj9sm2y2yensj3g454n3p6k2t6sr5';
const BTC_TO = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

beforeEach(() => {
	fetchAccountRc.mockReset();
	fetchBtcPayoutSwapMinRc.mockReset();
});

describe('buildWalletRouterSwapOps: the swap QuickSwap has always sent', () => {
	it('HBD on Magi to a Bitcoin address: one execute, HBD drawn under transfer.allow', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('10', Coin.hbd),
				minAmountOut: '5000',
				destinationChain: 'BTC',
				recipient: BTC_TO
			},
			{ feeQualifies: false, availableRc: 30_000 }
		);
		expect(r).toEqual({
			ok: true,
			ops: [
				{
					op: 'call',
					payload: {
						contract_id: SWAP_CONTRACT_ID,
						action: 'execute',
						// Byte for byte, key order included: the instruction QuickSwap built inline.
						payload: `{"type":"swap","version":"1.0.0","asset_in":"HBD","asset_out":"BTC","amount_in":"10000","min_amount_out":"5000","recipient":"${BTC_TO}","destination_chain":"BTC"}`,
						// 30,000 RC less the 10,000 milli-HBD the router pulls.
						rc_limit: 20_000,
						intents: [{ type: 'transfer.allow', args: { limit: '10.000', token: 'hbd' } }],
						caller: EVM
					}
				}
			]
		});
	});

	it('BTC on Magi to a Hive account: the allowance first, then the swap', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.btc,
				toCoin: Coin.hive,
				amount: new CoinAmount('0.001', Coin.btc),
				minAmountOut: '900',
				destinationChain: 'HIVE',
				recipient: 'hive:alice'
			},
			{ feeQualifies: false, availableRc: 5000 }
		);
		if (!r.ok) throw new Error(r.error);
		expect(r.ops).toHaveLength(2);
		expect(r.ops[0].payload).toEqual({
			contract_id: BTC_MAPPING_CONTRACT_ID,
			action: 'increaseAllowance',
			payload: JSON.stringify({ spender: `contract:${SWAP_CONTRACT_ID}`, amount: '100000' }),
			rc_limit: 1000,
			intents: [],
			caller: EVM
		});
		expect(r.ops[1].payload.intents).toEqual([]);
		expect(r.ops[1].payload.rc_limit).toBe(4000);
		expect(r.ops[1].payload.payload).toBe(
			'{"type":"swap","version":"1.0.0","asset_in":"BTC","asset_out":"HIVE","amount_in":"100000","min_amount_out":"900","recipient":"hive:alice","destination_chain":"HIVE"}'
		);
	});

	it('a custom-token input gets its allowance on its own contract', () => {
		const tok = { ...Coin.hbd, value: 'MAGIC', label: 'MAGIC', unit: 'MAGIC' } as typeof Coin.hbd;
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: tok,
				toCoin: Coin.hbd,
				amount: new CoinAmount(1000, tok, true),
				minAmountOut: '1',
				mappedContractId: 'vsc1token'
			},
			{ feeQualifies: false, availableRc: 5000 }
		);
		if (!r.ok) throw new Error(r.error);
		expect(r.ops[0].payload.contract_id).toBe('vsc1token');
	});

	it('kept on Magi: no destination_chain, the caller is paid (a Bitcoin wallet too)', () => {
		const instr = walletRouterSwapInstruction(
			{
				caller: LEATHER,
				fromCoin: Coin.btc,
				toCoin: Coin.hbd,
				amount: new CoinAmount('0.0005', Coin.btc),
				minAmountOut: '40000'
			},
			false
		);
		expect(instr).toEqual({
			type: 'swap',
			version: '1.0.0',
			asset_in: 'BTC',
			asset_out: 'HBD',
			amount_in: '50000',
			min_amount_out: '40000',
			recipient: LEATHER
		});
	});

	it('the Altera fee scales the minimum down by its bps and names the beneficiary', () => {
		const instr = walletRouterSwapInstruction(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('10', Coin.hbd),
				minAmountOut: '10000',
				destinationChain: 'BTC',
				recipient: BTC_TO
			},
			true
		);
		expect(instr.min_amount_out).toBe('9975');
		expect(instr.beneficiary).toBe('hive:altera.app');
		expect(instr.ref_bps).toBe(25);
	});

	it('refuses, before signing, a Bitcoin payout the account cannot pay RC for', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('10', Coin.hbd),
				minAmountOut: '5000',
				destinationChain: 'BTC',
				recipient: BTC_TO
			},
			{ feeQualifies: false, availableRc: 12_000 }
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/Not enough RC to pay out to a Bitcoin address/);
	});

	it('refuses a swap kept on Magi when the account has no RC (a Bitcoin wallet with no HBD)', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: LEATHER,
				fromCoin: Coin.btc,
				toCoin: Coin.hbd,
				amount: new CoinAmount('0.0005', Coin.btc),
				minAmountOut: '40000'
			},
			{ feeQualifies: false, availableRc: 0 }
		);
		expect(r.ok).toBe(false);
	});

	it('refuses a payout with no receiver', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('10', Coin.hbd),
				destinationChain: 'BTC'
			},
			{ feeQualifies: false, availableRc: 30_000 }
		);
		expect(r).toEqual({ ok: false, error: 'Enter a receiver address for the target chain' });
	});

	it('refuses a swap with no quote minimum (prices did not load): it would take any price', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('10', Coin.hbd)
			},
			{ feeQualifies: false, availableRc: 30_000 }
		);
		expect(r).toEqual({ ok: false, error: SWAP_NEEDS_QUOTE_MESSAGE });
	});

	it('a quote whose minimum rounds to 0 (a dust swap) still goes out', () => {
		const r = buildWalletRouterSwapOps(
			{
				caller: EVM,
				fromCoin: Coin.hbd,
				toCoin: Coin.btc,
				amount: new CoinAmount('0.001', Coin.hbd),
				minAmountOut: '0'
			},
			{ feeQualifies: false, availableRc: 30_000 }
		);
		expect(r.ok).toBe(true);
	});
});

describe('hasQuoteMinimum / getHiveSwapOp: a Hive swap needs the quote too', () => {
	it('only a missing minimum is refused', () => {
		expect(hasQuoteMinimum(undefined)).toBe(false);
		expect(hasQuoteMinimum(null)).toBe(false);
		expect(hasQuoteMinimum('')).toBe(false);
		expect(hasQuoteMinimum('abc')).toBe(false);
		expect(hasQuoteMinimum(-1)).toBe(false);
		expect(hasQuoteMinimum(0)).toBe(true);
		expect(hasQuoteMinimum('0')).toBe(true);
		expect(hasQuoteMinimum('4173')).toBe(true);
	});

	it('getHiveSwapOp refuses to build a swap with no minimum', async () => {
		await expect(
			getHiveSwapOp('alice', new CoinAmount('1', Coin.hive), Coin.hive, Coin.hbd, undefined)
		).rejects.toThrow(SWAP_NEEDS_QUOTE_MESSAGE);
	});
});

describe('prepareWalletRouterSwap', () => {
	const swap = {
		caller: EVM,
		fromCoin: Coin.hive,
		toCoin: Coin.hbd,
		amount: new CoinAmount('5', Coin.hive),
		minAmountOut: '1000'
	};
	it("sizes from the node's RC for the caller", async () => {
		fetchAccountRc.mockResolvedValue(3000);
		const r = await prepareWalletRouterSwap(swap, 99_999);
		expect(fetchAccountRc).toHaveBeenCalledWith(EVM);
		if (!r.ok) throw new Error(r.error);
		expect(r.ops[0].payload.rc_limit).toBe(3000);
	});
	it('falls back to the polled RC when the node does not answer', async () => {
		fetchAccountRc.mockResolvedValue(undefined);
		const r = await prepareWalletRouterSwap(swap, 2500);
		if (!r.ok) throw new Error(r.error);
		expect(r.ops[0].payload.rc_limit).toBe(2500);
	});
	it('does not ask for the payout minimum when the swap stays on Magi', async () => {
		fetchAccountRc.mockResolvedValue(3000);
		await prepareWalletRouterSwap(swap, 0);
		expect(fetchBtcPayoutSwapMinRc).not.toHaveBeenCalled();
	});

	const payout = {
		caller: EVM,
		fromCoin: Coin.hive,
		toCoin: Coin.btc,
		amount: new CoinAmount('100', Coin.hive),
		minAmountOut: '1000',
		destinationChain: 'BTC' as const,
		recipient: BTC_TO
	};
	it('a BTC payout is sized against the minimum of the chain as it is now', async () => {
		// 8 HBD of RC: under the original minimum, over the one from consensus 0.15.
		fetchAccountRc.mockResolvedValue(8000);

		fetchBtcPayoutSwapMinRc.mockResolvedValue(BTC_PAYOUT_SWAP_MIN_RC);
		const before = await prepareWalletRouterSwap(payout, 0);
		expect(before.ok).toBe(false);
		if (before.ok) throw new Error('expected a refusal');
		expect(before.error).toContain(`${BTC_PAYOUT_SWAP_MIN_RC.toLocaleString('en-US')} RC`);

		fetchBtcPayoutSwapMinRc.mockResolvedValue(BTC_PAYOUT_SWAP_MIN_RC_V0_15);
		const after = await prepareWalletRouterSwap(payout, 0);
		if (!after.ok) throw new Error(after.error);
		expect(after.ops[0].payload.rc_limit).toBe(8000);
	});

	it('an ETH payout needs the bridge pull and the extra hop on top of the minimum', async () => {
		// 2026-11-19 testnet at 0.15: ETH -> HBD -> BTC 6,544 RC, HBD -> BTC 5,487.
		fetchBtcPayoutSwapMinRc.mockResolvedValue(BTC_PAYOUT_SWAP_MIN_RC_V0_15);
		const ethPayout = { ...payout, fromCoin: Coin.eth, amount: new CoinAmount('0.03', Coin.eth) };
		const needed = BTC_PAYOUT_SWAP_MIN_RC_V0_15 + BTC_PAYOUT_EVM_INPUT_EXTRA_RC;
		expect(needed).toBeGreaterThanOrEqual(6_544 + 300);

		// Enough for an HBD payout (plus the allowance op), not for an ETH one.
		fetchAccountRc.mockResolvedValue(BTC_PAYOUT_SWAP_MIN_RC_V0_15 + 1000);
		const refused = await prepareWalletRouterSwap(ethPayout, 0);
		expect(refused.ok).toBe(false);
		if (refused.ok) throw new Error('expected a refusal');
		expect(refused.error).toContain(`${needed.toLocaleString('en-US')} RC`);

		fetchAccountRc.mockResolvedValue(needed + 1000);
		const sent = await prepareWalletRouterSwap(ethPayout, 0);
		if (!sent.ok) throw new Error(sent.error);
	});
});

describe('walletSwapFromMagi: which /swap sends are swaps', () => {
	const base = {
		caller: EVM,
		fromCoin: Coin.btc,
		toCoin: Coin.hbd,
		fromNetwork: Network.magi.value,
		toNetwork: Network.magi.value,
		fromAmount: '0.0005',
		toUsername: 'someone-else',
		minAmountOut: '40000',
		swapCoins: [Coin.hive.value, Coin.hbd.value, Coin.btc.value]
	};

	it('a send of one coin is not a swap', () => {
		expect(walletSwapFromMagi({ ...base, toCoin: Coin.btc })).toBeNull();
		expect(
			walletSwapFromMagi({
				...base,
				fromCoin: Coin.hbd,
				toCoin: Coin.hbd,
				toNetwork: Network.hiveMainnet.value
			})
		).toBeNull();
	});

	it('an input not on Magi is not handled here', () => {
		expect(walletSwapFromMagi({ ...base, fromNetwork: Network.btcMainnet.value })).toBeNull();
	});

	it('kept on Magi pays the caller, whatever the receiver field says', () => {
		const r = walletSwapFromMagi(base);
		expect(r && !('error' in r) && r.recipient).toBe(undefined);
		expect(r && !('error' in r) && r.destinationChain).toBe(undefined);
		expect(r && !('error' in r) && r.amount.amount).toBe(50_000);
	});

	it('a Hive payout names the hive: account', () => {
		const r = walletSwapFromMagi({
			...base,
			toNetwork: Network.hiveMainnet.value,
			toUsername: '@alice'
		});
		expect(r).toMatchObject({ destinationChain: 'HIVE', recipient: 'hive:alice' });
	});

	it('a Bitcoin payout keeps the address as entered', () => {
		const r = walletSwapFromMagi({
			...base,
			fromCoin: Coin.hbd,
			toCoin: Coin.btc,
			fromAmount: '10',
			toNetwork: Network.btcMainnet.value,
			toUsername: ` ${BTC_TO} `
		});
		expect(r).toMatchObject({ destinationChain: 'BTC', recipient: BTC_TO });
	});

	it('refuses a payout with no receiver, an unknown coin, an empty amount', () => {
		expect(
			walletSwapFromMagi({ ...base, toNetwork: Network.hiveMainnet.value, toUsername: ' ' })
		).toEqual({ error: 'Missing recipient address for mainnet settlement' });
		expect(walletSwapFromMagi({ ...base, toCoin: Coin.shbd })).toHaveProperty('error');
		expect(walletSwapFromMagi({ ...base, fromAmount: '' })).toHaveProperty('error');
		expect(walletSwapFromMagi({ ...base, fromAmount: '0' })).toHaveProperty('error');
	});

	it('refuses a payout network the router cannot settle on', () => {
		expect(walletSwapFromMagi({ ...base, toNetwork: Network.lightning.value })).toHaveProperty(
			'error'
		);
	});

	it('a custom token input carries its contract', () => {
		const tok = { ...Coin.hbd, value: 'MAGIC', label: 'MAGIC', unit: 'MAGIC' } as typeof Coin.hbd;
		const r = walletSwapFromMagi({
			...base,
			fromCoin: tok,
			fromAmount: '1',
			swapCoins: [...base.swapCoins, 'MAGIC'],
			customTokenContractId: 'vsc1token'
		});
		expect(r).toMatchObject({ mappedContractId: 'vsc1token' });
	});
});
