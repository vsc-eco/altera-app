/**
 * The Ethereum-wallet login's deposit (a plain transfer to the vault, credited
 * to the sender): nothing is signed unless the wallet holds the amount and the
 * ETH for the gas and the transfer simulates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';

const ME = '0x6266b79f55A3F0873e6d92FE76D33233ffCcbAeC';
const VAULT = '0x88161a75f8519d0d333c83012df78ada5fff796a';
const h = vi.hoisted(() => ({
	eth: 10n ** 18n,
	usdc: 100_000_000n,
	gasPrice: 1_000_000_000n,
	estimateFails: false
}));

vi.mock('$lib/auth/reown', () => ({ initModal: () => {}, wagmiConfig: {} }));
vi.mock('@wagmi/core', () => ({
	getAccount: () => ({ address: ME, chainId: 1 }),
	switchChain: vi.fn(),
	getBalance: async () => ({ value: h.eth }),
	readContract: async () => h.usdc,
	estimateGas: vi.fn(async () => {
		if (h.estimateFails)
			throw Object.assign(new Error('x'), { shortMessage: 'execution reverted' });
		return 60_000n;
	}),
	getGasPrice: async () => h.gasPrice,
	sendTransaction: vi.fn(async () => '0x' + '1'.repeat(64)),
	writeContract: vi.fn(async () => '0x' + '2'.repeat(64)),
	waitForTransactionReceipt: async () => ({ status: 'success' })
}));

const { sendBridgeDepositFromWallet } = await import('./bridgeDeposit');
const core = await import('@wagmi/core');

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(h, {
		eth: 10n ** 18n,
		usdc: 100_000_000n,
		gasPrice: 1_000_000_000n,
		estimateFails: false
	});
});

const send = (amt: string, coin: Coin) =>
	sendBridgeDepositFromWallet(new CoinAmount(amt, coin), VAULT, ME);

describe('sendBridgeDepositFromWallet (Ethereum-wallet login)', () => {
	it('sends ETH and USDC when the wallet can cover them', async () => {
		await send('0.01', Coin.eth);
		expect(core.sendTransaction).toHaveBeenCalledTimes(1);
		await send('5', Coin.usdc);
		expect(core.writeContract).toHaveBeenCalledTimes(1);
	});

	it('less USDC than the amount: nothing is signed', async () => {
		h.usdc = 128_312n;
		await expect(send('1', Coin.usdc)).rejects.toThrow(
			'The wallet holds 0.128312 USDC, less than the 1 USDC to deposit'
		);
		expect(core.writeContract).not.toHaveBeenCalled();
	});

	it('not enough ETH for the amount plus gas, or for the gas of a USDC transfer: nothing is signed', async () => {
		h.eth = 10_000_000_000_000_000n; // 0.01 ETH: exactly the amount, nothing for gas
		await expect(send('0.01', Coin.eth)).rejects.toThrow(/the deposit plus its gas needs about/);
		h.eth = 10_000_000_000_000n; // 0.00001 ETH; 60k gas at 1 gwei x 1.2 = 0.000072
		await expect(send('5', Coin.usdc)).rejects.toThrow(/the gas needs about 0.000072 ETH/);
		expect(core.sendTransaction).not.toHaveBeenCalled();
		expect(core.writeContract).not.toHaveBeenCalled();
	});

	it('a transfer that would revert: nothing is signed', async () => {
		h.estimateFails = true;
		await expect(send('5', Coin.usdc)).rejects.toThrow(
			'The deposit would fail on Ethereum (execution reverted), so nothing was sent.'
		);
		expect(core.writeContract).not.toHaveBeenCalled();
	});
});
