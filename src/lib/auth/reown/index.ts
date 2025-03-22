// import { VERCEL_URL } from '$env/static/public';
import { createAppKit } from '@reown/appkit';
import { mainnet } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { VERCEL_URL } from '$env/static/public';
import { _reownAuthStore } from '../store';

// 1. Get a project ID at https://cloud.reown.com
export const projectId = '55a54e098e74ddb214919fe0da4ac384';

export const networks = [mainnet];

// 2. Set up Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
	projectId,
	networks
});
// 3. Configure the metadata
const metadata = {
	name: 'VSC Frontend',
	description: '',
	url: VERCEL_URL.includes('localhost') ? `http://${VERCEL_URL}` : `https://${VERCEL_URL}`, // origin must match your domain & subdomain
	icons: ['https://avatars.githubusercontent.com/u/133249767']
};

export const modal = createAppKit({
	adapters: [wagmiAdapter],
	networks: [mainnet],
	metadata,
	projectId,
	features: {
		analytics: false // Optional - defaults to your Cloud configuration
	}
});

modal.subscribeAccount((value) => {
	console.log(value);
	if (value.isConnected) {
		_reownAuthStore.set({
			status: 'authenticated',
			value: {
				address: value.address,
				logout: modal.disconnect,
				provider: 'reown',
				openSettings: () => modal.open()
			}
		});
	} else if (value.status == 'connecting') {
		_reownAuthStore.set({
			status: 'pending'
		});
	} else {
		_reownAuthStore.set({
			status: 'none'
		});
	}
});
