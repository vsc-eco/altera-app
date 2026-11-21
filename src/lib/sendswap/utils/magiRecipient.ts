import { getAddress, isAddress } from 'viem';
import { validate as validateBtc, Network as BtcNetwork } from 'bitcoin-address-validation';
import { getDidFromUsername } from '$lib/getAccountName';

export type MagiRecipient = { ok: true; did: string } | { ok: false; error: string };

/** A valid Ethereum address: checksummed, or all lower / all upper case
 *  (EIP-55's unchecksummed forms; viem's isAddress refuses all upper case). */
export function isEthAddress(s: string): boolean {
	return isAddress(s) || /^0x[0-9A-F]{40}$/.test(s);
}

/** The same Magi account: an Ethereum address compares without case (its
 *  checksum is only casing), anything else exactly. */
export function sameMagiAccount(a: string, b: string): boolean {
	const evm = /^did:pkh:eip155:/i;
	return evm.test(a) && evm.test(b) ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** A Hive account name: 3-16 characters, dot-separated parts of at least 3,
 *  each starting with a letter and ending with a letter or digit. */
const HIVE_PART = /^[a-z][a-z0-9-]*[a-z0-9]$/;
function isHiveName(name: string): boolean {
	if (name.length < 3 || name.length > 16) return false;
	return name.split('.').every((p) => p.length >= 3 && HIVE_PART.test(p));
}

/**
 * The Magi account a swap kept on Magi pays when "Send to address" is chosen,
 * from what the user typed, or why it cannot be used. Strict on purpose:
 * - a 0x address must pass its checksum (a mixed-case address with one wrong
 *   character re-checksums to a valid address nobody owns, which getAddress
 *   alone would pay);
 * - a Hive name must be a valid one ("@bob" used to become "hive:@bob", which
 *   the router refuses only after the user signed);
 * - anything else is refused (an unrecognised string used to fall back to
 *   paying the sender while Review showed the typed text).
 */
export function magiRecipient(raw: string, btcTestnet = false): MagiRecipient {
	const s = raw.trim();
	if (!s) return { ok: false, error: 'Enter a receiver.' };

	const evm = s.match(/^did:pkh:eip155:(\d+):(0x[0-9a-fA-F]{40})$/);
	if (evm) {
		if (!isEthAddress(evm[2])) {
			return { ok: false, error: 'Not a valid Ethereum address: check its checksum.' };
		}
		return { ok: true, did: `did:pkh:eip155:${evm[1]}:${getAddress(evm[2].toLowerCase())}` };
	}
	if (/^0x/i.test(s)) {
		if (!isEthAddress(s)) {
			return {
				ok: false,
				error: 'Not a valid Ethereum address: 0x and 40 hex characters, checksum included.'
			};
		}
		return { ok: true, did: `did:pkh:eip155:1:${getAddress(s.toLowerCase())}` };
	}

	const btcNet = btcTestnet ? BtcNetwork.testnet : BtcNetwork.mainnet;
	const btcAddr = s.startsWith('did:pkh:bip122:') ? s.split(':').at(-1)! : s;
	if (validateBtc(btcAddr, btcNet)) {
		const did = getDidFromUsername(btcAddr);
		if (did) return { ok: true, did };
	}
	if (s.startsWith('did:pkh:bip122:')) {
		return { ok: false, error: 'Not a valid Bitcoin address.' };
	}

	const name = s.replace(/^hive:/, '').replace(/^@/, '');
	if (isHiveName(name)) return { ok: true, did: `hive:${name}` };
	if (isHiveName(name.toLowerCase())) {
		return { ok: false, error: `Hive account names are lower case: ${name.toLowerCase()}?` };
	}
	return {
		ok: false,
		error: 'Enter a Hive account, an Ethereum 0x address or a Bitcoin address.'
	};
}
