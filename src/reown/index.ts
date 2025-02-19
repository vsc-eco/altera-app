import { VERCEL_URL } from '$env/static/public';
import { createAppKit } from '@reown/appkit';
import { mainnet, arbitrum, sepolia } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 1. Get a project ID at https://cloud.reown.com
export const projectId = '55a54e098e74ddb214919fe0da4ac384';

export const networks = [mainnet, arbitrum];

// 2. Set up Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
	projectId,
	networks
});
// 3. Configure the metadata
const metadata = {
	name: 'VSC Frontend',
	description: '',
	url: VERCEL_URL != 'localhost' ? `https://${VERCEL_URL}` : 'http://localhost:5173', // origin must match your domain & subdomain
	icons: ['https://avatars.githubusercontent.com/u/133249767']
};

export const modal = createAppKit({
	adapters: [wagmiAdapter],
	networks: [mainnet, arbitrum, sepolia],
	metadata,
	projectId,
	features: {
		analytics: false // Optional - defaults to your Cloud configuration
	}
});
