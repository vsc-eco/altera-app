import { getAccount, reconnect } from '@wagmi/core';
import { wagmiConfig } from '.';

export const ensureWalletConnection = async (): Promise<boolean> => {
	const account = getAccount(wagmiConfig);

	if (account.status !== 'connected') {
		await reconnect(wagmiConfig);
	}
	return getAccount(wagmiConfig).isConnected;
};
