import { initAioha, KeyTypes, Providers, type Aioha } from '@aioha/aioha';
import { VERCEL_URL } from '$env/static/public';
import { browser } from '$app/environment';
import { _hiveAuthStore } from '../store';
import { goto } from '$app/navigation';
import { getAccounts } from '@aioha/aioha/build/rpc';
import {
	postingMetadataFromString,
	type Account
} from '../../../routes/(authed)/hive-account/accountTypes';

async function getProfilePicUrl(username: string) {
	const res: Account = (await getAccounts([username])).result[0];
	if (res) return postingMetadataFromString(res.posting_json_metadata).profile.profile_image;
}
let aioha: Aioha;
_hiveAuthStore.subscribe((value) => {
	if (value.value) {
		getProfilePicUrl(value.value.address).then((pp) => {
			if (value.value != undefined && pp && value.value.profilePicUrl == undefined) {
				console.log('HERE');
				value.value.profilePicUrl = pp;
				_hiveAuthStore.set(value);
			}
		});
	}
});

if (browser) {
	aioha = initAioha({
		hiveauth: {
			name: "VSC's Altera",
			description: 'VSC/Hive exchange',
			icon: 'https://avatars.githubusercontent.com/u/133249767'
		},
		hivesigner: {
			app: 'altera.app',
			callbackURL:
				(VERCEL_URL.includes('localhost') ? `https://${VERCEL_URL}` : `https://${VERCEL_URL}`) +
				'/hivesigner',
			scope: ['login']
		}
	});
	if (aioha.isLoggedIn()) {
		_hiveAuthStore.set({
			status: 'authenticated',
			value: {
				address: aioha.getCurrentUser()!,
				username: aioha.getCurrentUser(),
				logout: logout,
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
					logout: logout,
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
		msg: 'Sign into Altera',
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
				logout,
				provider: 'aioha',
				openSettings: () => goto('/hive-account'),
				aioha
			}
		});
	}
	return login;
}

export async function logout() {
	_hiveAuthStore.set({ status: 'none' });
	await aioha.logout();
}
