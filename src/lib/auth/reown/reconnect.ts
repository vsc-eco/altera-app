import { getAccount, getConnection, reconnect } from '@wagmi/core';
import { wagmiConfig, modal } from '.';

export const ensureWalletConnection = async (): Promise<boolean> => {
	// Check Reown modal first — covers both BTC (BitcoinAdapter) and EVM wallets.
	if (modal?.getAddress()) return true;

	// Fallback: Wagmi reconnect for EVM wallets that lost adapter state.
	if (!wagmiConfig) return false;
	const { status } = getAccount(wagmiConfig);
	if (status !== 'connected') {
		await reconnect(wagmiConfig);
	}
	return getConnection(wagmiConfig).isConnected;
};
