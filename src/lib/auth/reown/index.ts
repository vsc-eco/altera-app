// import { VERCEL_URL } from '$env/static/public';
import { createAppKit } from '@reown/appkit';
import { mainnet } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { DOMAIN } from '../url';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { cleanUpLogout, loginRetry } from '../store';

// 1. Get a project ID at https://cloud.reown.com
export const projectId = '55a54e098e74ddb214919fe0da4ac384';

export const networks = [mainnet];

// 2. Set up Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
	projectId,
	networks
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

// 3. Configure the metadata
const metadata = {
	name: 'VSC Frontend',
	description: '',
	url: `https://${DOMAIN}`, // origin must match your domain & subdomain
	icons: ['https://avatars.githubusercontent.com/u/133249767']
};

export const modal = createAppKit({
	adapters: [wagmiAdapter],
	networks: [mainnet],
	metadata,
	projectId,
	features: {
		analytics: false, // Optional - defaults to your Cloud configuration
		connectMethodsOrder: ['wallet']
	}
});

// Set initial state to none after a delay, only if still pending
setTimeout(async () => {
	const { _reownAuthStore } = await import('../store');
	const { get } = await import('svelte/store');
	const current = get(_reownAuthStore);
	if (current?.status === 'pending') {
		_reownAuthStore.set({ status: 'none' });
	}
}, 2000);

modal.subscribeAccount(async (value: { isConnected: any; address: string; status: string; }) => {
	try {
		const { _reownAuthStore, loginRetry } = await import('../store');

		if (value.isConnected) {
			_reownAuthStore.set({
				status: 'authenticated',
				value: {
					address: value.address!,
					logout: reownLogout,
					provider: 'reown',
					did: `did:pkh:eip155:1:${value.address!}`,
					openSettings: () => modal.open()
				}
			});
			if (get(loginRetry) !== 'logout') {
				loginRetry.set('retry');
			}
		} else if (value.status == 'connecting') {
			_reownAuthStore.set({
				status: 'pending'
			});
		} else {
			_reownAuthStore.set({
				status: 'none'
			});
		}
	} catch {}
});

export async function reownLogout() {
	loginRetry.set('logout');
	await modal.disconnect();
	cleanUpLogout();
}
