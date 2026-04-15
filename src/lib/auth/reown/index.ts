// import { VERCEL_URL } from '$env/static/public';
import { createAppKit } from '@reown/appkit';
import { mainnet } from '@reown/appkit/networks';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import { bitcoin, bitcoinTestnet } from '@reown/appkit/networks';
import { DOMAIN } from '../url';
import { get } from 'svelte/store';
import { cleanUpLogout, loginRetry } from '../store';
import { isBtcTestnetAddress } from '$lib/stores/currentBalance';
import { BTC_MAINNET_CAIP, BTC_TESTNET_CAIP } from '../btcCaip';

// 1. Get a project ID at https://cloud.reown.com
export const projectId = '55a54e098e74ddb214919fe0da4ac384';

// `bitcoinTestnet` is listed FIRST so AppKit's BitcoinAdapter picks
// it as the active CAIP network at `wallet_connect` time. Our
// patched HelperUtil maps `bitcoinTestnet.caipNetworkId` to
// `BitcoinNetworkType.Testnet` (testnet3), which is where real
// Leather/Xverse users have their UTXOs. Mainnet BTC users can
// switch via the AppKit modal. BTC vs VSC network are intentionally
// independent: a mainnet VSC chain user may still be testing with a
// testnet3 Leather wallet, so we don't couple them.
export const networks = [mainnet, bitcoinTestnet, bitcoin];

export let wagmiConfig: WagmiAdapter['wagmiConfig'] | null = null;
export let modal: ReturnType<typeof createAppKit> | null = null;

let lastAddress: string | undefined;

/** AppKit persists the last active CAIP network in
 *  `@appkit/active_caip_network_id` and on reload restores it,
 *  overriding our `networks` list order. If the persisted value is
 *  the bip122 MAINNET (`000000000019d6689c085ae165831e93`), rewrite
 *  it to `bitcoinTestnet`'s CAIP so testnet wins on init. We leave
 *  EVM (`eip155:*`) values alone. */
function normalizeStoredBtcNetwork() {
	if (typeof localStorage === 'undefined') return;
	try {
		const KEY = '@appkit/active_caip_network_id';
		const stored = localStorage.getItem(KEY);
		if (stored && stored.startsWith('bip122:')) {
			localStorage.setItem(KEY, bitcoinTestnet.caipNetworkId);
		}
	} catch {}
}

export function initModal() {
	if (modal) return;
	normalizeStoredBtcNetwork();

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
		networks: networks as [(typeof networks)[number], ...(typeof networks)[number][]],
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
				_reownAuthStore.set({
					status: 'authenticated',
					value: {
						address: value.address!,
						logout: reownLogout,
						provider: 'reown',
						did: value.caipAddress?.startsWith('bip122:')
							? `did:pkh:bip122:${
									isBtcTestnetAddress(value.address!)
										? BTC_TESTNET_CAIP
										: BTC_MAINNET_CAIP
								}:${value.address!}`
							: `did:pkh:eip155:1:${value.address!}`,
						openSettings: () => modal!.open()
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
}

export function openModal() {
	initModal();
	modal!.open();
}

export async function reownLogout() {
	loginRetry.set('logout');
	await modal?.disconnect();
	cleanUpLogout();
}
