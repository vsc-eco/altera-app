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
import { mainnetSwapDest, Network } from './sendOptions';

/** Where the output lands, which is what decides the address format. */
export type RecipientTarget = 'magi' | 'hive' | 'btc' | 'eth';

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
		case 'eth':
			return 'an Ethereum address (0x…)';
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
		case 'eth':
			// A payout on Ethereum is sent by the bridge to this address on
			// chain. Only a 0x address can receive it — a Hive name here would
			// revert the router call and spend the RC — and the bridge itself
			// refuses the zero address, which is the one 0x form that passes
			// the shape test and burns the funds.
			if (!EVM_ADDRESS.test(addr)) {
				return { ok: false, reason: `That is not ${recipientHint('eth')}.` };
			}
			return /^0x0{40}$/i.test(addr)
				? { ok: false, reason: 'The zero address cannot receive a payout.' }
				: { ok: true };
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

/**
 * Can the CONNECTED account itself act on `networkValue` — sign a payment
 * from it, or be paid on it without an address being typed?
 *
 * The swap card's "my own wallet" destination pays `getUsernameFromAuth`,
 * which is a Hive name on an aioha login and a BTC or EVM address on a reown
 * one. `send()` then prefixes a Hive-L1 payout with `hive:`, so a
 * wallet-logged-in user settling to Hive mainnet would have built
 * `hive:bc1q…` — a recipient that reverts the router call on chain and spends
 * the RC for nothing. Mainnet-to-mainnet is the normal swap (M9), so this is
 * what keeps that default from reaching an account that cannot receive there.
 *
 * Magi is always true: every login has a Magi ledger account.
 */
export function canUseMainnetSelf(
	networkValue: string | undefined,
	did: string | undefined,
	provider: string | undefined
): boolean {
	if (networkValue === 'magi') return true;
	if (networkValue === 'hive_mainnet') return provider === 'aioha';
	if (networkValue === 'btc_mainnet') return !!did?.startsWith('did:pkh:bip122:');
	return false;
}

/** The two destinations the swap card offers, and the two networks for them. */
export type DestRecipient = 'wallet' | 'address';
export type DestNetworkChoice = 'mainnet' | 'magi';

export type DestResolution = {
	/** The network the output will actually settle on. */
	network: Network;
	/**
	 * Why mainnet settlement is unavailable, when it is. The card turns this
	 * into a sentence — the asset's display name and the chain's label live
	 * there, and differ on testnet.
	 */
	blocked?: 'magi-only-asset' | 'wallet-cannot-receive';
};

/**
 * Where a swap's output settles, from the two things the user controls and the
 * two the login decides.
 *
 * Pure and tested here rather than assembled in the card, because getting it
 * wrong misroutes money: the previous version pinned Magi whenever the user
 * was paying themselves, so "my own wallet" and "stays on Magi" were the same
 * switch and the normal swap could never settle on mainnet (M9).
 *
 * `choice` is the user's standing preference and is never overwritten — a
 * Magi-only asset resolves to Magi without clearing it, so selecting a custom
 * token and then selecting HBD again returns to mainnet settlement.
 */
export function resolveDestNetwork(args: {
	toCoin: string | undefined;
	choice: DestNetworkChoice;
	recipient: DestRecipient;
	did: string | undefined;
	provider: string | undefined;
}): DestResolution {
	const mainnet = mainnetSwapDest(args.toCoin);
	// No mainnet form exists for this asset: a custom token, sHBD.
	if (mainnet.value === Network.magi.value) {
		return { network: Network.magi, blocked: 'magi-only-asset' };
	}
	// Paying yourself on a mainnet needs the login to exist on that chain.
	// Typing an address is exempt: that is the user naming the recipient.
	if (args.recipient === 'wallet' && !canUseMainnetSelf(mainnet.value, args.did, args.provider)) {
		return { network: Network.magi, blocked: 'wallet-cannot-receive' };
	}
	return { network: args.choice === 'magi' ? Network.magi : mainnet };
}
