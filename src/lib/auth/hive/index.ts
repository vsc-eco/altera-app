import { initAioha, KeyTypes, Providers, Aioha } from '@aioha/aioha';
// import { VERCEL_URL } from '$env/static/public';
const VERCEL_URL = 'localhost:5173';
import { _authStore } from '../store';
import { browser } from '$app/environment';
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
		_authStore.set({
			status: 'authenticated',
			value: {
				username: aioha.getCurrentUser(),
				aioha: aioha
			}
		});
	}
	aioha.on('account_changed', () => {
		const user = aioha.getCurrentUser();
		let authStore;
		if (user != undefined) {
			authStore = {
				status: 'authenticated' as const,
				value: {
					username: user,
					aioha: aioha
				}
			};
		} else {
			authStore = {
				status: 'none' as const
			};
		}
		_authStore.set(authStore);
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
				// display HiveAuth QR code using payload as data
			}
		},
		keyType: KeyTypes.Posting
	});
	if (login.success) {
		_authStore.set({
			status: 'authenticated',
			value: {
				username: aioha.getCurrentUser(),
				aioha: aioha
			}
		});
	}
	return login;
}

export async function logout() {
	_authStore.set({ status: 'none' });
	await aioha.logout();
}
