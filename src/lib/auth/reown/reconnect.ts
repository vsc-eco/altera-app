import { getAccount, getConnection, getConnectors, reconnect } from '@wagmi/core';
import { wagmiConfig, initModal } from '.';
import { browser } from '$app/environment';

export const ensureWalletConnection = async (): Promise<boolean> => {
	initModal();
	const { address, isConnected, status } = getAccount(wagmiConfig);
	const connnectors = getConnectors(wagmiConfig);

	if (status !== 'connected') {
		await reconnect(wagmiConfig);
	}
	return getConnection(wagmiConfig).isConnected;
};
