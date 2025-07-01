import { writable } from 'svelte/store';
import { getAccount, connect, getConnectors } from '@wagmi/core';
import { wagmiConfig } from '.';
import type { AppKit } from '@reown/appkit';

export const isReconnecting = writable(false);

export const ensureWalletConnection = async (modal: AppKit): Promise<boolean> => {
	const account = getAccount(wagmiConfig);

	if (account.status !== 'connected') {
		isReconnecting.set(true);
		try {
			await modal.open();

			return new Promise((resolve) => {
				const checkConnection = () => {
					const currentAccount = getAccount(wagmiConfig);
					if (currentAccount.status === 'connected') {
						isReconnecting.set(false);
						resolve(true);
					} else {
						setTimeout(checkConnection, 500);
					}
				};

				checkConnection();

				setTimeout(() => {
					isReconnecting.set(false);
					resolve(false);
				}, 30000);
			});
		} catch (error) {
			isReconnecting.set(false);
			console.error('Reconnection failed:', error);
			return false;
		}
	}
    return true;
};
