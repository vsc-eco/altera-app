import { afterEach, describe, expect, it, vi } from 'vitest';

// The swap-vs-send decision (sendUtils) treats a pair as a swap only when both
// coins are swap coins; with ETH/USDC missing, an HBD -> ETH swap on testnet was
// built as a bridge transfer of the output ETH to the caller (2026-11-19).
async function load(enabled: boolean) {
	vi.resetModules();
	vi.doMock('$lib/constants', async (importOriginal) => ({
		...(await importOriginal<typeof import('$lib/constants')>()),
		EVM_BRIDGE_ENABLED: enabled
	}));
	return import('./sendOptions');
}

afterEach(() => {
	vi.doUnmock('$lib/constants');
});

describe('nativeSwapCoins', () => {
	it('swaps ETH and USDC when the EVM bridge is enabled', async () => {
		const { nativeSwapCoins, Coin } = await load(true);
		expect(nativeSwapCoins()).toEqual([
			Coin.hive.value,
			Coin.hbd.value,
			Coin.btc.value,
			Coin.eth.value,
			Coin.usdc.value
		]);
	});

	it('is HIVE, HBD and BTC alone without the bridge (mainnet until launch)', async () => {
		const { nativeSwapCoins, Coin } = await load(false);
		expect(nativeSwapCoins()).toEqual([Coin.hive.value, Coin.hbd.value, Coin.btc.value]);
	});
});
