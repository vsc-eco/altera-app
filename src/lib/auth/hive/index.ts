import { initAioha, KeyTypes, Providers, Aioha } from '@aioha/aioha';
import { VERCEL_URL } from '$env/static/public';
import { browser } from '$app/environment';
import { _hiveAuthStore } from '../store';
let aioha: Aioha;

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
				(VERCEL_URL.includes('localhost') ? `http://${VERCEL_URL}` : `https://${VERCEL_URL}`) +
				'/hivesigner',
			scope: ['login']
		}
	});
	if (aioha.isLoggedIn()) {
		_hiveAuthStore.set({
			status: 'authenticated',
			value: {
				username: aioha.getCurrentUser()
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
					username: user
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
 */
export async function login(
	username: string,
	provider: 'keychain' | 'hivesigner' | 'hiveauth' | 'ledger' | 'peakvault' | 'custom'
) {
	let aiohaProvider: Providers;
	switch (provider) {
		case 'keychain':
			aiohaProvider = Providers.Keychain;
			break;
		default:
			aiohaProvider = Providers.Custom;
	}
	const login = await aioha.login(aiohaProvider, username, {
		msg: 'Sign into Altera',
		hiveauth: {
			cbWait: (payload, evt) => {
				// TODO: display HiveAuth QR code using payload as data
			}
		},
		keyType: KeyTypes.Posting
	});
	if (login.success) {
		_hiveAuthStore.set({
			status: 'authenticated',
			value: {
				username: aioha.getCurrentUser()
			}
		});
	}
	return login;
}

export async function logout() {
	_hiveAuthStore.set({ status: 'none' });
	await aioha.logout();
}
