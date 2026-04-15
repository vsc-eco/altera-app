// import { VERCEL_URL } from '$env/static/public';
import { createAppKit } from '@reown/appkit';
import { mainnet } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import { bitcoin, bitcoinTestnet } from '@reown/appkit/networks';
import { DOMAIN } from '../url';
import { get } from 'svelte/store';
import { cleanUpLogout, loginRetry } from '../store';

// 1. Get a project ID at https://cloud.reown.com
export const projectId = '55a54e098e74ddb214919fe0da4ac384';

export const networks = [mainnet, bitcoin, bitcoinTestnet];

export let wagmiConfig: WagmiAdapter['wagmiConfig'] | null = null;
export let modal: ReturnType<typeof createAppKit> | null = null;

let lastAddress: string | undefined;

// localStorage key for the optimistic session cache we write when
// subscribeAccount fires successfully, so a subsequent F5 can
// restore auth to `authenticated` immediately without prompting
// the wallet extension for a fresh connection.
export const REOWN_SESSION_KEY = 'reown_session_v1';

export type ReownCachedSession = {
	address: string;
	did: string;
	caipAddress?: string;
};

function saveCachedSession(session: ReownCachedSession) {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(REOWN_SESSION_KEY, JSON.stringify(session));
	} catch {}
}

export function clearCachedSession() {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.removeItem(REOWN_SESSION_KEY);
	} catch {}
}

export function loadCachedSession(): ReownCachedSession | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		const raw = localStorage.getItem(REOWN_SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			typeof parsed.address !== 'string' ||
			typeof parsed.did !== 'string'
		) {
			return null;
		}
		return parsed as ReownCachedSession;
	} catch {
		return null;
	}
}

export function initModal() {
	if (modal) return;

	// 2. Set up Wagmi adapter
	const wagmiAdapter = new WagmiAdapter({
		projectId,
		networks
	});

	wagmiConfig = wagmiAdapter.wagmiConfig;

	const bitcoinAdapter = new BitcoinAdapter({ projectId });

	// 3. Configure the metadata
	const metadata = {
		name: 'VSC Frontend',
		description: '',
		url: `https://${DOMAIN}`, // origin must match your domain & subdomain
		icons: ['https://avatars.githubusercontent.com/u/133249767']
	};

	modal = createAppKit({
		adapters: [wagmiAdapter, bitcoinAdapter],
		networks: [mainnet, bitcoin, bitcoinTestnet],
		metadata,
		projectId,
		features: {
			analytics: false, // Optional - defaults to your Cloud configuration
			connectMethodsOrder: ['wallet']
		}
	});

	modal.subscribeAccount(async (value) => {
		try {
			if (value.isConnected && value.address === lastAddress) return;
			lastAddress = value.isConnected ? value.address : undefined;

			const { _reownAuthStore, loginRetry } = await import('../store');

			if (value.isConnected) {
				// Reject Taproot (bc1p) addresses — backend does not support P2TR yet
				if (value.address?.startsWith('bc1p')) {
					console.warn('Taproot (P2TR) addresses are not yet supported');
					await reownLogout();
					_reownAuthStore.set({ status: 'none' });
					return;
				}
				const did = value.caipAddress?.startsWith('bip122:')
					? `did:pkh:bip122:000000000019d6689c085ae165831e93:${value.address!}`
					: `did:pkh:eip155:1:${value.address!}`;
				_reownAuthStore.set({
					status: 'authenticated',
					value: {
						address: value.address!,
						logout: reownLogout,
						provider: 'reown',
						did,
						openSettings: () => modal!.open()
					}
				});
				// Persist an optimistic session for the next page load so
				// F5 can restore `authenticated` without re-prompting
				// the wallet. See `loadCachedSession` / AuthInjector.
				saveCachedSession({
					address: value.address!,
					did,
					caipAddress: value.caipAddress
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
				clearCachedSession();
			}
		} catch {}
	});
}

export function openModal() {
	initModal();
	modal!.open();
}

export async function reownLogout() {
	loginRetry.set('logout');
	clearCachedSession();
	await modal?.disconnect();
	cleanUpLogout();
}
