import type { Auth } from './auth/store';
import { validate, Network as BtcNetwork } from 'bitcoin-address-validation';

export const getAccountNameFromAuth = (auth: Auth) => {
	if (auth.value == undefined) {
		return undefined;
	}
	const u = auth.value.username || auth.value.address;
	if (!u) {
		return;
	}
	return shortenUsername(u);
};

export const getAccountNameFromAddress = (addr: string) => {
	return shortenUsername(addr);
};

function shortenUsername(u: string) {
	if (u.length > 16) {
		if (u.startsWith('bc1')) {
			return u.slice(0, 8) + '…' + u.slice(-5);
		}
		return u.slice(0, 6) + '…' + u.slice(-4);
	}
	return u;
}

export const getUsernameFromDid = (did: string) => {
	// BTC DIDs use ":" to separate chain hash from address:
	// did:pkh:bip122:000000000019d6689c085ae165831e93:bc1q...
	return did.split(':').at(-1)!;
};

export const getUsernameFromAuth = (auth: Auth) => {
	if (auth.value?.provider === 'aioha') {
		return auth.value.username;
	} else if (auth.value?.provider === 'reown') {
		return auth.value.address;
	}
};

export const getAccountNameFromDid = (did: string) => {
	return shortenUsername(getUsernameFromDid(did));
};

export const getDidFromUsername = (username: string) => {
	// Already a full DID or hive-prefixed — pass through
	if (username.startsWith('did:pkh:') || username.startsWith('hive:')) {
		return username;
	}
	if (username.length <= 16) {
		return `hive:${username}`;
	}
	if (username.startsWith('0x')) {
		return `did:pkh:eip155:1:${username}`;
	}
	// Strip chain hash prefix if present (e.g. "000...e93:bc1q...")
	const rawAddr = username.includes(':') ? username.split(':').at(-1)! : username;
	if (validate(rawAddr, BtcNetwork.mainnet)) {
		return `did:pkh:bip122:000000000019d6689c085ae165831e93:${rawAddr}`;
	}
	return ``;
};
