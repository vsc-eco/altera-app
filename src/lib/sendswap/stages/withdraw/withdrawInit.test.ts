import { describe, it, expect } from 'vitest';
import { Coin, Network } from '../../utils/sendOptions';
import {
	initHiveMainnetWithdraw,
	initBtcMainnetWithdraw,
	initLightningWithdraw,
	initWithdrawStateForDestination,
	type WithdrawInitState
} from './withdrawInit';

function blank(): WithdrawInitState {
	return { from: undefined, to: undefined };
}

describe('withdrawInit', () => {
	it('Hive mainnet: from = {asset, magi}, to = {asset, hiveMainnet}', () => {
		for (const coin of [Coin.hive, Coin.hbd]) {
			const s = blank();
			initHiveMainnetWithdraw(s, coin);
			expect(s.from).toEqual({ coin, network: Network.magi });
			expect(s.to).toEqual({ coin, network: Network.hiveMainnet });
		}
	});

	it('Bitcoin mainnet: BTC from magi → BTC on btcMainnet', () => {
		const s = blank();
		initBtcMainnetWithdraw(s);
		expect(s.from).toEqual({ coin: Coin.btc, network: Network.magi });
		expect(s.to).toEqual({ coin: Coin.btc, network: Network.btcMainnet });
	});

	it('Lightning: BTC from magi → lightning network', () => {
		const s = blank();
		initLightningWithdraw(s);
		expect(s.from).toEqual({ coin: Coin.btc, network: Network.magi });
		expect(s.to?.network.value).toBe(Network.lightning.value);
	});

	it('dispatch routes by destination and uses the chosen asset', () => {
		const s = blank();
		initWithdrawStateForDestination(s, 'hive_mainnet', Coin.hbd);
		expect(s.to).toEqual({ coin: Coin.hbd, network: Network.hiveMainnet });

		const s2 = blank();
		initWithdrawStateForDestination(s2, 'btc_mainnet', Coin.btc);
		expect(s2.to?.network.value).toBe(Network.btcMainnet.value);
	});

	it('coinbase is a no-op (coming soon)', () => {
		const s = blank();
		initWithdrawStateForDestination(s, 'coinbase', Coin.btc);
		expect(s.from).toBeUndefined();
		expect(s.to).toBeUndefined();
	});
});
