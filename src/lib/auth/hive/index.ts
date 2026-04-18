import { Aioha, KeyTypes, Providers } from '@aioha/aioha';
import { DOMAIN } from '../url';
import { browser } from '$app/environment';
import { _hiveAuthStore, cleanUpLogout, loginRetry } from '../store';
import { goto } from '$app/navigation';
import { getAccounts } from '@aioha/aioha/build/rpc';
import { postingMetadataFromString, type Account } from './accountTypes';
import { vscNetworkId, isVscTestnet } from '../../../client';

// Hive L1 chain IDs. Mainnet has the well-known default; testnet uses a
// different chain ID and MetaMask Snap refuses to sign anything unless the
// right one is set via `aioha.setChainId()`.
const HIVE_MAINNET_CHAIN_ID =
	'beeab0de00000000000000000000000000000000000000000000000000000000';
const HIVE_TESTNET_CHAIN_ID =
	'18dcf0a285365fc58b71f18b3d3fec954aa0c141c44e4e5cb4cf777b9eab274e';

// Hive L1 RPC endpoints. Testnet must NOT fall through to api.hive.blog or
// broadcasts get rejected ("missing active authority") because the mainnet
// node can't verify a testnet-chain-id signature.
const HIVE_MAINNET_API = 'https://api.hive.blog';
const HIVE_TESTNET_API = 'https://testnet.techcoderx.com';

async function getProfilePicUrl(username: string) {
	const res: Account = (await getAccounts([username])).result[0];
	if (res) return postingMetadataFromString(res.posting_json_metadata).profile.profile_image;
}
let aioha: Aioha;

if (browser) {
	_hiveAuthStore.subscribe((value) => {
		if (value.value) {
			getProfilePicUrl(value.value.address).then((pp) => {
				if (value.value != undefined && pp && value.value.profilePicUrl == undefined) {
					value.value.profilePicUrl = pp;
					_hiveAuthStore.set(value);
				}
			});
		}
	});

	try {
		const isLocalhost = DOMAIN.includes('localhost') || DOMAIN.includes('127.0.0.1');
		// Instantiate Aioha directly with the right Hive L1 RPC for this
		// network so broadcasts go to the node that can verify our signature.
		const hiveApiUrl = isVscTestnet() ? HIVE_TESTNET_API : HIVE_MAINNET_API;
		aioha = new Aioha(hiveApiUrl);
		aioha.setup({
			hiveauth: {
				name: "Magi's Altera",
				description: 'Magi/Hive exchange',
				icon: 'https://avatars.githubusercontent.com/u/133249767'
			},
			...(!isLocalhost
				? {
						hivesigner: {
							app: 'altera.app',
							callbackURL: `https://${DOMAIN}/hivesigner`,
							scope: ['login'],
							apiURL: 'https://hive-api.web3telekom.xyz/'
						}
					}
				: {})
		});
		// Tell Aioha which VSC network we're on so ops go to the right net.
		try {
			(aioha as unknown as { vscSetNetId?: (id: string) => void }).vscSetNetId?.(
				vscNetworkId
			);
		} catch (err) {
			console.warn('aioha.vscSetNetId failed', err);
		}
		// Tell Aioha (and through it, MetaMask Snap) which Hive L1 chain to
		// sign against. Required for the Snap to sign testnet ops correctly.
		try {
			(aioha as unknown as { setChainId?: (id: string) => void }).setChainId?.(
				isVscTestnet() ? HIVE_TESTNET_CHAIN_ID : HIVE_MAINNET_CHAIN_ID
			);
		} catch (err) {
			console.warn('aioha.setChainId failed', err);
		}
		if (aioha.isLoggedIn()) {
			_hiveAuthStore.set({
				status: 'authenticated',
				value: {
					address: aioha.getCurrentUser()!,
					username: aioha.getCurrentUser(),
					logout: hiveLogout,
					did: `hive:${aioha.getCurrentUser()}`,
					provider: 'aioha',
					openSettings: () => goto('/hive-account'),
					aioha
				}
			});
		} else {
			_hiveAuthStore.set({ status: 'none' });
		}
		aioha.on('account_changed', () => {
			const user = aioha.getCurrentUser();
			let authStore;
			if (user != undefined) {
				authStore = {
					status: 'authenticated' as const,
					value: {
						address: user,
						username: user,
						logout: hiveLogout,
						did: `hive:${user}`,
						provider: 'aioha' as const,
						openSettings: () => goto('/hive-account'),
						aioha
					}
				};
			} else {
				authStore = {
					status: 'none' as const
				};
			}
			_hiveAuthStore.set(authStore);
		});
	} catch (e) {
		console.warn('Aioha init failed (expected on localhost):', e);
		_hiveAuthStore.set({ status: 'none' });
	}
}
/**
 *
 * @param username
 * @param provider one of: Keychain, HiveSigner, HiveAuth, Ledger, PeakVault, MetaMaskSnap, Custom
 * @param displayQr
 */
export async function login(
	username: string,
	provider:
		| 'keychain'
		| 'hivesigner'
		| 'hiveauth'
		| 'ledger'
		| 'peakvault'
		| 'metamasksnap'
		| 'custom',
	displayQr: (data: string) => void
) {
	let aiohaProvider: Providers;
	switch (provider) {
		case 'keychain':
			aiohaProvider = Providers.Keychain;
			break;
		case 'hiveauth':
			aiohaProvider = Providers.HiveAuth;
			break;
		case 'hivesigner':
			aiohaProvider = Providers.HiveSigner;
			break;
		case 'ledger':
			aiohaProvider = Providers.Ledger;
			break;
		case 'peakvault':
			aiohaProvider = Providers.PeakVault;
			break;
		case 'metamasksnap':
			aiohaProvider = Providers.MetaMaskSnap;
			break;
		default:
			aiohaProvider = Providers.Custom;
	}
	const login = await aioha.login(aiohaProvider, username, {
		msg: `Sign into Altera`,
		hiveauth: {
			cbWait: (payload) => {
				displayQr(payload);
				// TODO: display HiveAuth QR code using payload as data
			}
		},
		keyType: KeyTypes.Posting
	});
	if (login.success) {
		_hiveAuthStore.set({
			status: 'authenticated',
			value: {
				address: aioha.getCurrentUser()!,
				username: aioha.getCurrentUser(),
				did: `hive:${aioha.getCurrentUser()!}`,
				logout: hiveLogout,
				provider: 'aioha',
				openSettings: () => goto('/hive-account'),
				aioha
			}
		});
	}
	return login;
}

export async function hiveLogout() {
	loginRetry.set('logout');
	_hiveAuthStore.set({ status: 'none' });
	await aioha.logout();
	cleanUpLogout();
}
