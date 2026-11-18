import { describe, expect, it } from 'vitest';
import { decideBroadcast } from './broadcastDecision';
import {
	Coin,
	Network,
	isSelectableSource,
	mainnetSwapSource,
	resolveSourceNetwork
} from './sendOptions';
import { canUseMainnetSelf, resolveDestNetwork } from './recipientValidation';
import type { TxState } from './txState.svelte';

const state = (
	from: { coin: typeof Coin.btc; network: Network },
	to: { coin: typeof Coin.btc; network: Network }
) => ({ from, to }) as unknown as TxState;

/**
 * `send()` can only classify a swap whose source sits on Magi, or on Hive L1
 * when the asset is native HIVE/HBD (it prepends the deposit op). Any other
 * source falls through every swap branch to the generic builder, which signs a
 * plain transfer of the OUTPUT asset to whatever is in `toUsername` — the H1
 * shape. `swapOptions.from` lists BTC on Bitcoin because the deposit, withdraw
 * and transfer flows share that table and legitimately source BTC there, so
 * the swap-source rule has to be its own predicate.
 */
describe('swap source networks send() can actually classify', () => {
	it('accepts Magi for every swap asset', () => {
		for (const c of [Coin.btc, Coin.hive, Coin.hbd, Coin.shbd]) {
			expect(isSelectableSource(c.value, Network.magi.value)).toBe(true);
		}
	});

	it('accepts Hive L1 for native HIVE and HBD (the deposit-then-swap path)', () => {
		expect(isSelectableSource(Coin.hive.value, Network.hiveMainnet.value)).toBe(true);
		expect(isSelectableSource(Coin.hbd.value, Network.hiveMainnet.value)).toBe(true);
	});

	/** No BTC deposit op exists in the swap path — only `getBtcApproveOp`,
	 *  which pulls Magi-ledger BTC. */
	it('rejects BTC on Bitcoin, which has no deposit-then-swap path', () => {
		expect(isSelectableSource(Coin.btc.value, Network.btcMainnet.value)).toBe(false);
	});

	it('rejects sHBD on Hive L1, which does not exist there', () => {
		expect(isSelectableSource(Coin.shbd.value, Network.hiveMainnet.value)).toBe(false);
	});

	it('still rejects Lightning, which the v4v branch handles before the gate', () => {
		expect(isSelectableSource(Coin.btc.value, Network.lightning.value)).toBe(false);
	});

	/** The live H1-shaped hole: this pair is pickable in the source dialog. */
	it('makes BTC-on-Bitcoin -> HIVE-on-Hive unsignable instead of a transfer', () => {
		const d = decideBroadcast(
			state(
				{ coin: Coin.btc, network: Network.btcMainnet },
				{ coin: Coin.hive as typeof Coin.btc, network: Network.hiveMainnet }
			),
			'swap'
		);
		expect(d.action).toBe('error');
	});

	it('leaves a BTC withdrawal from Magi to Bitcoin alone', () => {
		const d = decideBroadcast(
			state(
				{ coin: Coin.btc, network: Network.magi },
				{ coin: Coin.btc, network: Network.btcMainnet }
			),
			'withdraw'
		);
		expect(d.action).toBe('send');
	});
});

describe('mainnetSwapSource', () => {
	it('starts HIVE and HBD on Hive L1', () => {
		expect(mainnetSwapSource(Coin.hive.value).value).toBe(Network.hiveMainnet.value);
		expect(mainnetSwapSource(Coin.hbd.value).value).toBe(Network.hiveMainnet.value);
	});

	/** BTC's mainnet is not a usable swap source, so the card starts on Magi
	 *  rather than offering a pair that cannot be signed. */
	it('starts BTC on Magi', () => {
		expect(mainnetSwapSource(Coin.btc.value).value).toBe(Network.magi.value);
	});

	it('starts Magi-only assets on Magi', () => {
		expect(mainnetSwapSource(Coin.shbd.value).value).toBe(Network.magi.value);
		expect(mainnetSwapSource('LASSECASH').value).toBe(Network.magi.value);
	});
});

/**
 * Settling "to my own wallet" on a mainnet only works when the connected
 * account exists on that chain — the recipient is the login itself, not a
 * typed address.
 */
describe('canUseMainnetSelf', () => {
	const hiveLogin = { did: 'did:pkh:hive:tibfox', provider: 'aioha' };
	const btcLogin = {
		did: 'did:pkh:bip122:000000000019d6689c085ae165831e93:bc1qexample',
		provider: 'reown'
	};
	const evmLogin = { did: 'did:pkh:eip155:1:0xabc', provider: 'reown' };

	it('lets every login settle on Magi', () => {
		for (const l of [hiveLogin, btcLogin, evmLogin]) {
			expect(canUseMainnetSelf(Network.magi.value, l.did, l.provider)).toBe(true);
		}
	});

	it('lets only a Hive login settle on Hive mainnet', () => {
		expect(canUseMainnetSelf(Network.hiveMainnet.value, hiveLogin.did, hiveLogin.provider)).toBe(
			true
		);
		expect(canUseMainnetSelf(Network.hiveMainnet.value, btcLogin.did, btcLogin.provider)).toBe(
			false
		);
		expect(canUseMainnetSelf(Network.hiveMainnet.value, evmLogin.did, evmLogin.provider)).toBe(
			false
		);
	});

	it('lets only a BTC login settle on Bitcoin', () => {
		expect(canUseMainnetSelf(Network.btcMainnet.value, btcLogin.did, btcLogin.provider)).toBe(true);
		expect(canUseMainnetSelf(Network.btcMainnet.value, hiveLogin.did, hiveLogin.provider)).toBe(
			false
		);
		expect(canUseMainnetSelf(Network.btcMainnet.value, evmLogin.did, evmLogin.provider)).toBe(
			false
		);
	});

	it('refuses Lightning and an unknown network, and a missing login', () => {
		expect(canUseMainnetSelf(Network.lightning.value, hiveLogin.did, hiveLogin.provider)).toBe(
			false
		);
		expect(canUseMainnetSelf('nonsense', hiveLogin.did, hiveLogin.provider)).toBe(false);
		expect(canUseMainnetSelf(Network.hiveMainnet.value, undefined, undefined)).toBe(false);
		expect(canUseMainnetSelf(Network.btcMainnet.value, undefined, undefined)).toBe(false);
	});
});

describe('resolveDestNetwork', () => {
	const hive = { did: 'did:pkh:hive:tibfox', provider: 'aioha' };
	const btc = {
		did: 'did:pkh:bip122:000000000019d6689c085ae165831e93:bc1qexample',
		provider: 'reown'
	};
	const base = { choice: 'mainnet', recipient: 'wallet' } as const;

	/** M9: the normal swap — Advanced off — settles on mainnet. */
	it('settles a Hive login to Hive mainnet by default', () => {
		const r = resolveDestNetwork({ ...base, toCoin: Coin.hbd.value, ...hive });
		expect(r.network.value).toBe(Network.hiveMainnet.value);
		expect(r.blocked).toBeUndefined();
	});

	it('settles a BTC login to Bitcoin by default', () => {
		const r = resolveDestNetwork({ ...base, toCoin: Coin.btc.value, ...btc });
		expect(r.network.value).toBe(Network.btcMainnet.value);
		expect(r.blocked).toBeUndefined();
	});

	it('honours the Magi choice, which is an Advanced control', () => {
		const r = resolveDestNetwork({ ...base, choice: 'magi', toCoin: Coin.hbd.value, ...hive });
		expect(r.network.value).toBe(Network.magi.value);
		expect(r.blocked).toBeUndefined();
	});

	/** The bogus `hive:bc1q…` recipient this exists to prevent. */
	it('keeps a BTC login on Magi when the output is HBD', () => {
		const r = resolveDestNetwork({ ...base, toCoin: Coin.hbd.value, ...btc });
		expect(r.network.value).toBe(Network.magi.value);
		expect(r.blocked).toBe('wallet-cannot-receive');
	});

	it('keeps a Hive login on Magi when the output is BTC', () => {
		const r = resolveDestNetwork({ ...base, toCoin: Coin.btc.value, ...hive });
		expect(r.network.value).toBe(Network.magi.value);
		expect(r.blocked).toBe('wallet-cannot-receive');
	});

	/** A typed address is the user naming the recipient, so no login is needed. */
	it('allows a BTC login to send HBD to a Hive address', () => {
		const r = resolveDestNetwork({
			...base,
			recipient: 'address',
			toCoin: Coin.hbd.value,
			...btc
		});
		expect(r.network.value).toBe(Network.hiveMainnet.value);
		expect(r.blocked).toBeUndefined();
	});

	it('pins a Magi-only asset to Magi whoever is logged in', () => {
		for (const l of [hive, btc]) {
			for (const recipient of ['wallet', 'address'] as const) {
				const r = resolveDestNetwork({ ...base, recipient, toCoin: Coin.shbd.value, ...l });
				expect(r.network.value).toBe(Network.magi.value);
				expect(r.blocked).toBe('magi-only-asset');
			}
		}
		expect(resolveDestNetwork({ ...base, toCoin: 'LASSECASH', ...hive }).blocked).toBe(
			'magi-only-asset'
		);
	});

	/** Selecting a custom token must not silently rewrite the preference. */
	it('returns to mainnet after a Magi-only detour, because choice is untouched', () => {
		const detour = resolveDestNetwork({ ...base, toCoin: Coin.shbd.value, ...hive });
		expect(detour.network.value).toBe(Network.magi.value);
		const back = resolveDestNetwork({ ...base, toCoin: Coin.hbd.value, ...hive });
		expect(back.network.value).toBe(Network.hiveMainnet.value);
	});

	it('keeps a logged-out visitor on Magi rather than guessing', () => {
		const r = resolveDestNetwork({
			...base,
			toCoin: Coin.hbd.value,
			did: undefined,
			provider: undefined
		});
		expect(r.network.value).toBe(Network.magi.value);
		expect(r.blocked).toBe('wallet-cannot-receive');
	});
});

/**
 * The token picker's "clicked the other slot's token" shortcut swaps both
 * sides, and gave the NEW source coin the OLD source's network. That is the
 * H1 shape in a path the H1 fix did not cover: the flip was resolved, this
 * was not.
 *
 * It was near-unreachable while every source sat on Magi. M9 makes Hive L1
 * the normal source, so "HBD on Hive L1 -> BTC" became one click away from
 * "BTC on Hive L1", a pair BTC cannot be on.
 */
describe('swapping slots keeps a source the new coin can be on', () => {
	it('does not put BTC on Hive L1', () => {
		expect(resolveSourceNetwork(Coin.btc.value, Network.hiveMainnet.value).value).toBe(
			Network.magi.value
		);
		expect(isSelectableSource(Coin.btc.value, Network.hiveMainnet.value)).toBe(false);
	});

	it('refuses to sign it if one is built anyway', () => {
		const d = decideBroadcast(
			state(
				{ coin: Coin.btc, network: Network.hiveMainnet },
				{ coin: Coin.hbd as typeof Coin.btc, network: Network.magi }
			),
			'swap'
		);
		expect(d.action).toBe('error');
	});

	it('keeps Hive L1 when the new source coin can be there', () => {
		expect(resolveSourceNetwork(Coin.hbd.value, Network.hiveMainnet.value).value).toBe(
			Network.hiveMainnet.value
		);
	});
});
