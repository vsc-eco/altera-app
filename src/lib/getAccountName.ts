import type { Auth } from './auth/store';

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

export const accountNameFromAddress = (addr: string) => {
	return shortenUsername(addr);
};

function shortenUsername(u: string) {
	if (u.length > 16) {
		return u.slice(0, 6) + '…' + u.slice(-4);
	}
	return u;
}

export const getAccountNameFromDid = (did: string) => {
	const u = did.split(':').at(-1)!;
	return shortenUsername(u);
};

export const getDidFromUsername = (username: string) => {
	if (username.length <= 16) {
		return `hive:${username}`
	}
	return ``
}
