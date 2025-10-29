import { initAioha, KeyTypes, Providers, type Aioha } from '@aioha/aioha';
import { DOMAIN } from '../url';
import { browser } from '$app/environment';
import { _hiveAuthStore, cleanUpLogout, loginRetry } from '../store';
import { goto } from '$app/navigation';
import { getAccounts } from '@aioha/aioha/build/rpc';
import { postingMetadataFromString, type Account } from './accountTypes';

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

	aioha = initAioha({
		hiveauth: {
			name: "Magi's Altera",
			description: 'Magi/Hive exchange',
			icon: 'https://avatars.githubusercontent.com/u/133249767'
		},
		hivesigner: {
			app: 'altera.app',
			callbackURL: `https://${DOMAIN}/hivesigner`,
			scope: ['login'],
			apiURL: 'https://hive-api.web3telekom.xyz/'
		}
	});
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
}
/**
 *
 * @param username
 * @param provider one of: Keychain, HiveSigner, HiveAuth, Ledger, PeakVault, Custom
 * @param displayQr
 */
export async function login(
	username: string,
	provider: 'keychain' | 'hivesigner' | 'hiveauth' | 'ledger' | 'peakvault' | 'custom',
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
