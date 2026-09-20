/**
 * Resolving a send's from/to catalog entries.
 *
 * `send()` read the STATIC swap catalog — HIVE/HBD/sHBD/BTC only — with
 * non-null assertions:
 *
 *   const toCoin = getToOption(details.to!.coin.value)!;
 *
 * A custom token isn't in that catalog, so `toCoin` was `undefined` while the
 * `!` told the compiler otherwise. The first `toCoin.coin` downstream threw
 *
 *   TypeError: can't access property "coin", a is undefined
 *
 * which is why swapping HBD → LASSECASH failed at broadcast even after the
 * picker, routing and approve paths all worked.
 */
import { describe, expect, it } from 'vitest';
import { resolveSendAssets } from './sendUtils';
import { Coin, Network, getToOption } from './sendOptions';

const LASSE = {
	symbol: 'lassecash',
	label: 'LASSECASH',
	name: 'LasseCash',
	decimals: 8,
	contractId: 'vsc1BUDsVccMPGycTmpc98WsQYSKyTBsZqFq4h',
	poolContractId: 'vsc1BrBFAwZ3Mr8L4ijRqT9RPEPvhK9FWDaYSr',
	routerRegistered: true
};

describe('the gap this closes', () => {
	it('the static catalog genuinely has no entry for a custom token', () => {
		expect(getToOption('lassecash')).toBeUndefined();
	});
});

describe('resolveSendAssets', () => {
	it('resolves a custom token as the TO asset — the reported failure', () => {
		const { from, to } = resolveSendAssets('hbd', 'lassecash', [LASSE]);
		expect(from?.coin.value).toBe('hbd');
		expect(to?.coin.value).toBe('lassecash');
		// The thing that actually threw.
		expect(to!.coin.label).toBe('LASSECASH');
	});

	it('resolves a custom token as the FROM asset', () => {
		const { from, to } = resolveSendAssets('lassecash', 'hbd', [LASSE]);
		expect(from?.coin.value).toBe('lassecash');
		expect(to?.coin.value).toBe('hbd');
	});

	it('gives a custom token a Magi-only network list', () => {
		const { to } = resolveSendAssets('hbd', 'lassecash', [LASSE]);
		expect(to?.networks.map((n) => n.value)).toEqual([Network.magi.value]);
	});

	it('carries the token decimals, so amounts scale correctly', () => {
		const { to } = resolveSendAssets('hbd', 'lassecash', [LASSE]);
		expect(to?.coin.decimalPlaces).toBe(8);
	});

	it('still resolves native pairs from the static catalog', () => {
		const { from, to } = resolveSendAssets('hive', 'hbd', []);
		expect(from?.coin.value).toBe(Coin.hive.value);
		expect(to?.coin.value).toBe(Coin.hbd.value);
		expect(from!.networks.length).toBeGreaterThan(1);
	});

	it('returns undefined for a genuinely unknown asset rather than a broken entry', () => {
		const { to } = resolveSendAssets('hbd', 'nosuchtoken', [LASSE]);
		expect(to).toBeUndefined();
	});

	it('returns undefined for a custom token that is not swappable', () => {
		// Empty list = nothing the router can route.
		expect(resolveSendAssets('hbd', 'lassecash', []).to).toBeUndefined();
	});
});
