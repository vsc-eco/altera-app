/**
 * Which deposit each login gets on the ETH / USDC deposit page.
 *
 * - Hive login: the browser's Ethereum wallet signs a MagiDeposit call that names
 *   the Hive account, inside withSideWallet (the wallet never becomes the login).
 * - Ethereum-wallet login (Reown): the connected wallet sends, as before.
 * - Bitcoin-wallet login (Reown): no browser-wallet deposit, since Reown's own
 *   connectors would pick that wallet up next to the Bitcoin login.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { Coin } from '$lib/sendswap/utils/sendOptions';

const h = vi.hoisted(() => ({
	auth: { status: 'authenticated', value: {} as Record<string, unknown> },
	coin: 'eth'
}));
const DC = '0x9cbe4Cf36d89A11FB584E514b6BB9d6177416096';

vi.mock('$lib/auth/store', () => ({ getAuth: () => () => h.auth }));
// The amount field's USD readout is not under test: no price feed here (its
// fetch of /api/cryptoprices would reject unhandled and fail the run).
vi.mock('$lib/currency/convert', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/currency/convert')>()),
	getExchangeRates: async () => null
}));
vi.mock('$lib/stores/currentBalance', () => ({
	evmMinDeposit: readable({ eth: 1_000_000_000_000_000, usdc: 300_000 }),
	evmProofFee: readable({ eth: 0, usdc: 0 })
}));
vi.mock('$lib/sendswap/utils/txState.svelte', async () => {
	const { Coin } = await import('$lib/sendswap/utils/sendOptions');
	return {
		useDepositState: () => ({ to: { coin: h.coin === 'usdc' ? Coin.usdc : Coin.eth } })
	};
});
vi.mock('$lib/magiTransactions/eth/bridgeDeposit', () => ({
	fetchActiveVaultAddress: vi.fn().mockResolvedValue('0x88161a75f8519d0d333c83012df78ada5fff796a'),
	fetchDepositContractAddress: vi.fn().mockResolvedValue(DC),
	sendBridgeDepositFromWallet: vi.fn().mockResolvedValue('0x' + '1'.repeat(64)),
	etherscanTxUrl: (h: string) => `https://etherscan.io/tx/${h}`
}));
const walletProvider = { request: vi.fn() };
vi.mock('$lib/magiTransactions/eth/magiDeposit', () => ({
	watchBrowserWallets: vi.fn((cb: (w: unknown[]) => void) => {
		cb([{ id: 'io.metamask', name: 'MetaMask', provider: walletProvider }]);
		return () => {};
	}),
	sendMagiDepositFromBrowserWallet: vi.fn().mockResolvedValue('0x' + '2'.repeat(64))
}));
vi.mock('$lib/auth/sideWallet', () => ({
	withSideWallet: vi.fn((_id: string, fn: () => Promise<unknown>) => fn())
}));

const { default: EthereumDeposit } = await import('./EthereumDeposit.svelte');
const { sendMagiDepositFromBrowserWallet } = await import('$lib/magiTransactions/eth/magiDeposit');
const { sendBridgeDepositFromWallet, fetchDepositContractAddress, fetchActiveVaultAddress } =
	await import('$lib/magiTransactions/eth/bridgeDeposit');
const { withSideWallet } = await import('$lib/auth/sideWallet');

beforeEach(() => {
	vi.clearAllMocks();
	h.coin = 'eth';
});

function loginAs(value: Record<string, unknown>) {
	h.auth = { status: 'authenticated', value };
}

describe('EthereumDeposit per login', () => {
	it('Hive login: one button per browser wallet, credited to the Hive account', async () => {
		loginAs({ did: 'hive:alice', username: 'alice', provider: 'aioha' });
		render(EthereumDeposit);
		await waitFor(() => expect(screen.getByText('hive:alice')).toBeTruthy());
		expect(await screen.findByRole('button', { name: /Deposit ETH with MetaMask/ })).toBeTruthy();
		expect(screen.queryByText(/logged in with a Bitcoin wallet/)).toBeNull();
		expect(screen.queryByText(/Sent from your connected wallet/)).toBeNull();
		// the wrong-network warning (WRONG-CHAIN): the same 0x address on BSC,
		// Base or Arbitrum is not the bridge
		expect(screen.getByRole('note').textContent).toMatch(
			/Ethereum Mainnet only\..*BSC, Base, Arbitrum or any other network\s+is lost/s
		);
	});

	it('Hive login: the deposit names the Hive account and runs inside withSideWallet', async () => {
		loginAs({ did: 'hive:alice', username: 'alice', provider: 'aioha' });
		render(EthereumDeposit);
		const btn = await screen.findByRole('button', { name: /Deposit ETH with MetaMask/ });
		const input = document.querySelector('input[inputmode=decimal]') as HTMLInputElement;
		// zag's number input commits its value on blur, like the user tabbing away.
		input.focus();
		await fireEvent.input(input, { target: { value: '0.005' } });
		await fireEvent.change(input, { target: { value: '0.005' } });
		await fireEvent.blur(input);
		await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
		await fireEvent.click(btn);
		await waitFor(() => expect(sendMagiDepositFromBrowserWallet).toHaveBeenCalledTimes(1));
		expect(withSideWallet).toHaveBeenCalledWith('io.metamask', expect.any(Function));
		const [amount, contract, vault, did, provider] = vi.mocked(sendMagiDepositFromBrowserWallet)
			.mock.calls[0];
		expect(vault).toBe('0x88161a75f8519d0d333c83012df78ada5fff796a');
		expect(amount.coin.value).toBe(Coin.eth.value);
		expect(amount.amount).toBe(5_000_000_000_000_000);
		expect(contract).toBe(DC);
		expect(did).toBe('hive:alice');
		expect(provider).toBe(walletProvider);
		expect(sendBridgeDepositFromWallet).not.toHaveBeenCalled();
		// read once when the page loads and again at send time (a rotation may have happened)
		expect(fetchDepositContractAddress).toHaveBeenCalledTimes(2);
		expect(fetchActiveVaultAddress).toHaveBeenCalledTimes(2);
	});

	it('Hive login, USDC: same buttons, plus the two-prompt note', async () => {
		h.coin = 'usdc';
		loginAs({ did: 'hive:alice', username: 'alice', provider: 'aioha' });
		render(EthereumDeposit);
		expect(await screen.findByRole('button', { name: /Deposit USDC with MetaMask/ })).toBeTruthy();
		expect(screen.getByText(/the wallet asks twice/)).toBeTruthy();
	});

	it('Ethereum-wallet login: the connected wallet sends, no browser-wallet buttons', async () => {
		const addr = '0x6266b79f55A3F0873e6d92FE76D33233ffCcbAeC';
		loginAs({ did: `did:pkh:eip155:1:${addr}`, address: addr, provider: 'reown' });
		render(EthereumDeposit);
		await waitFor(() => expect(screen.getByText(/Sent from your connected wallet/)).toBeTruthy());
		expect(screen.queryByRole('button', { name: /with MetaMask/ })).toBeNull();
		// this login gets the vault address to copy: warned, and the copy box names the network
		expect(screen.getByRole('note').textContent).toMatch(/Ethereum Mainnet only\./);
		expect(screen.getByText('Bridge vault address (Ethereum Mainnet)')).toBeTruthy();
	});

	it('Bitcoin-wallet login: no browser-wallet deposit at all', async () => {
		const addr = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
		loginAs({
			did: `did:pkh:bip122:000000000019d6689c085ae165831e93:${addr}`,
			address: addr,
			provider: 'reown'
		});
		render(EthereumDeposit);
		await waitFor(() => expect(screen.getByText(/logged in with a Bitcoin wallet/)).toBeTruthy());
		expect(screen.queryByRole('button', { name: /with MetaMask/ })).toBeNull();
		expect(screen.queryByText(/Sent from your connected wallet/)).toBeNull();
		// nothing to deposit with here, so no network warning
		expect(screen.queryByRole('note')).toBeNull();
	});
});
