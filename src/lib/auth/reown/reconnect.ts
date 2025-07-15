import { getAccount, getConnectors, reconnect } from '@wagmi/core';
import { wagmiConfig } from '.';
import { browser } from '$app/environment';

export const ensureWalletConnection = async (): Promise<boolean> => {
	const { address, isConnected, status } = getAccount(wagmiConfig);
	const connnectors = getConnectors(wagmiConfig);

	if (status !== 'connected') {
		await reconnect(wagmiConfig);
	}
	return getAccount(wagmiConfig).isConnected;
};