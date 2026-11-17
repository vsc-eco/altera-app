/**
 * Who a swap pays, checked against where it is going.
 *
 * The swap card validated exactly one case — a BTC payout to a Bitcoin
 * address — and did it silently: the Review button simply stayed disabled
 * with nothing on screen saying why. A Hive-mainnet payout accepted any
 * non-empty string, and the Magi option accepted anything at all because the
 * address was ignored entirely (M1). A malformed Hive name makes the whole
 * router transaction revert on chain, so the RC is spent for nothing; a
 * well-formed but wrong one simply pays a stranger.
 *
 * Separate from the card so each target's rule is stated once and tested.
 */
import { validate as validateBtcAddr, Network as BtcNetwork } from 'bitcoin-address-validation';
import { hiveRegex } from '$lib/auth/validateHiveUsername';

/** Where the output lands, which is what decides the address format. */
export type RecipientTarget = 'magi' | 'hive' | 'btc';

export type RecipientCheck = { ok: true } | { ok: false; reason: string };

/**
 * `hiveRegex` ends WITHOUT a `$`. That is fine where the app uses it — an
 * HTML `pattern=` attribute, which anchors both ends implicitly — but with
 * `.test()` it matches a prefix, so "has space" and "not an address" both
 * pass. Anchor it here. Not lower-cased either: Hive account names are
 * lower-case, so "UPPERCASE" is not a name that exists and saying so beats
 * silently paying `hive:UPPERCASE`.
 */
const HIVE_NAME = new RegExp(`${hiveRegex}$`);
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Strips the decoration people paste along with a name. */
function bare(address: string): string {
	return address
		.trim()
		.replace(/^@/, '')
		.replace(/^hive:/, '');
}

function isHiveName(address: string): boolean {
	return HIVE_NAME.test(bare(address));
}

function isBtcAddress(address: string, testnet: boolean): boolean {
	return validateBtcAddr(address.trim(), testnet ? BtcNetwork.testnet : BtcNetwork.mainnet);
}

/** What the field should say it accepts, for this target only. */
export function recipientHint(target: RecipientTarget): string {
	switch (target) {
		case 'btc':
			return 'a Bitcoin address';
		case 'hive':
			return 'a Hive username';
		case 'magi':
			return 'a Hive username, or an EVM or Bitcoin address';
	}
}

/**
 * Checked on every asset or network change, not only on submit — the target
 * can change under an address that was typed for a different one.
 */
export function validateRecipient(
	address: string,
	target: RecipientTarget,
	opts: { testnet?: boolean } = {}
): RecipientCheck {
	const addr = address.trim();
	if (!addr) return { ok: false, reason: `Enter ${recipientHint(target)}.` };

	switch (target) {
		case 'btc':
			return isBtcAddress(addr, !!opts.testnet)
				? { ok: true }
				: {
						ok: false,
						reason: opts.testnet
							? 'That is not a valid testnet Bitcoin address.'
							: 'That is not a valid Bitcoin address.'
					};
		case 'hive':
			return isHiveName(addr)
				? { ok: true }
				: {
						ok: false,
						reason:
							'That is not a valid Hive username. Use 3–16 characters: letters, digits and dashes.'
					};
		case 'magi':
			// A Magi account can be reached as a Hive name or as the address of
			// an EVM or Bitcoin wallet, all of which `getDidFromUsername`
			// resolves to a DID.
			return isHiveName(addr) ||
				EVM_ADDRESS.test(addr) ||
				isBtcAddress(addr, !!opts.testnet) ||
				addr.startsWith('did:pkh:')
				? { ok: true }
				: {
						ok: false,
						reason: `That is not ${recipientHint('magi')}.`
					};
	}
}
