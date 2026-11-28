import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { getDidFromUsername } from '$lib/getAccountName';
import {
	BTC_SENDER_REFUNDS_ACTIVE,
	DEPOSIT_SWAP_REFUNDS_ACTIVE,
	MIN_BTC_DEPOSIT_SWAP_SATS
} from '$lib/constants';

/**
 * Swaps paid with Bitcoin from the user's own wallet (Leather, Xverse, ...).
 *
 * Bitcoin on L1 is not on Magi yet, so there is no Magi transaction to sign.
 * The swap goes through a deposit address instead, the way the QuickSwap card
 * does it: the mapping bot returns an address bound to a swap instruction, the
 * user sends BTC there, and the BTC mapping contract runs the swap through the
 * DEX router when the deposit is mapped.
 */

/** The swap side of a BTC deposit instruction, as the user entered it. */
export type BtcSwapInstructionInput = {
	/** Hive name (`name`, `@name`, `hive:name`), DID, or BTC/EVM address. */
	recipient: string | undefined;
	/** Coin value of the swap output (`hbd`, `hive`, a custom token symbol). */
	toCoin: string;
	/** Network value the output settles on. */
	toNetwork: string;
	/** The BTC amount, in sats (refused below MIN_BTC_DEPOSIT_SWAP_SATS). */
	amountSats?: number;
	/**
	 * Where the BTC goes back if the swap does not complete: the sender's own
	 * hive: account or Bitcoin address (never a third party).
	 */
	refundTo?: string;
	/** Smallest output accepted, in the output asset's smallest units. */
	minAmountOut?: string;
	/** Defaults to DEPOSIT_SWAP_REFUNDS_ACTIVE (tests set it). */
	refundsActive?: boolean;
	/**
	 * Defaults to BTC_SENDER_REFUNDS_ACTIVE (tests set it): the contract refunds
	 * the address that sent the BTC, so refund_to is optional and the swap can be
	 * paid out on Ethereum.
	 */
	senderRefunds?: boolean;
	/** An ETH payout's Ethereum gas limit (ethPayoutGasLimit), when estimated. */
	payoutGasLimit?: number | null;
	/**
	 * Which Bitcoin network this instruction is for, so a refund address on the
	 * other one is caught here instead of at the mapping bot. Omitted: unchecked.
	 */
	testnet?: boolean;
};

export type BtcSwapInstruction =
	| { ok: true; instruction: string; recipient: string }
	| { ok: false; error: string };

/** bech32/bech32m human-readable parts, by network. */
const BECH32_HRP: Record<string, 'mainnet' | 'testnet'> = {
	bc: 'mainnet',
	tb: 'testnet',
	bcrt: 'testnet'
};
/** base58check leading characters (version byte), by network. */
const BASE58_FIRST: Record<string, 'mainnet' | 'testnet'> = {
	'1': 'mainnet',
	'3': 'mainnet',
	m: 'testnet',
	n: 'testnet',
	'2': 'testnet'
};
const BASE58_BODY = /^[1-9A-HJ-NP-Za-km-z]{26,35}$/;
const BECH32_BODY = /^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,71}$/;

/**
 * Which Bitcoin network `raw` is an address for, or null when it is not one.
 *
 * Checks the prefix, the charset and the length. A leading-character test alone
 * (the first cut of this accepted anything starting with 1, 2, 3, m or n) let
 * plain typos through as "a Bitcoin address" and could not tell mainnet from
 * testnet, so a wrong-network refund address only failed later at the mapping
 * bot. The bot and the contract remain authoritative (btcutil.DecodeAddress
 * verifies the checksum, which is not worth a dependency here); this only has
 * to stop what the user can still fix in the form.
 */
export function btcAddressNetwork(raw: string | undefined): 'mainnet' | 'testnet' | null {
	const addr = (raw ?? '').trim();
	if (!addr) return null;
	// bech32 is case-insensitive but must not be MIXED case (BIP173).
	if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) {
		const lower = addr.toLowerCase();
		const sep = lower.lastIndexOf('1');
		if (sep > 0 && lower.length >= 14 && lower.length <= 74) {
			const net = BECH32_HRP[lower.slice(0, sep)];
			if (net && BECH32_BODY.test(lower.slice(sep + 1))) return net;
		}
	}
	const net = BASE58_FIRST[addr[0]];
	return net && BASE58_BODY.test(addr) ? net : null;
}

/**
 * Build the mapping-bot instruction for a BTC deposit swap.
 *
 * Same keys and encoding as the QuickSwap card: `swap_to`, `swap_asset_out`,
 * and `destination_chain=HIVE` when the output settles on Hive. A Magi
 * destination leaves `destination_chain` out, which the router treats as Magi.
 * The contract refuses a BTC destination and any `swap_to` that is not a user
 * address, so both are rejected here before an address is requested.
 */
export function buildBtcSwapInstruction(input: BtcSwapInstructionInput): BtcSwapInstruction {
	if (input.toCoin === Coin.btc.value) {
		return { ok: false, error: 'Pick a coin other than BTC to swap into.' };
	}

	const senderRefunds = input.senderRefunds ?? BTC_SENDER_REFUNDS_ACTIVE;
	let destinationChain: string | undefined;
	if (input.toNetwork === Network.hiveMainnet.value) {
		destinationChain = 'HIVE';
	} else if (input.toNetwork === Network.ethMainnet.value && senderRefunds) {
		if (input.toCoin !== Coin.eth.value && input.toCoin !== Coin.usdc.value) {
			return { ok: false, error: 'On Ethereum a swap paid with Bitcoin pays ETH or USDC.' };
		}
		destinationChain = 'ETH';
	} else if (input.toNetwork !== Network.magi.value) {
		return {
			ok: false,
			error: senderRefunds
				? 'A swap paid with Bitcoin can settle on Magi, Hive or Ethereum.'
				: 'A swap paid with Bitcoin can settle on Magi or Hive only.'
		};
	}

	const raw = (input.recipient ?? '').trim().replace(/^@/, '');
	if (!raw) {
		return { ok: false, error: 'Enter a receiver.' };
	}
	if (destinationChain === 'ETH') {
		// The BTC contract pays a user identity: an Ethereum address as its DID,
		// which the router pays at the address.
		const addr = raw.replace(/^did:pkh:eip155:1:/i, '');
		if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || /^0x0{40}$/.test(addr)) {
			return { ok: false, error: 'Enter an Ethereum address to receive on Ethereum.' };
		}
		return finishBtcSwapInstruction(
			input,
			`did:pkh:eip155:1:${addr.toLowerCase()}`,
			destinationChain,
			senderRefunds
		);
	}
	const recipient = getDidFromUsername(raw);
	if (!recipient || !(recipient.startsWith('hive:') || recipient.startsWith('did:pkh:'))) {
		return { ok: false, error: `"${raw}" is not a valid receiver.` };
	}
	if (destinationChain === 'HIVE' && !recipient.startsWith('hive:')) {
		return { ok: false, error: 'Enter a Hive account to receive on Hive.' };
	}

	return finishBtcSwapInstruction(input, recipient, destinationChain, senderRefunds);
}

function finishBtcSwapInstruction(
	input: BtcSwapInstructionInput,
	recipient: string,
	destinationChain: string | undefined,
	senderRefunds: boolean
): BtcSwapInstruction {
	if (input.amountSats !== undefined && input.amountSats < MIN_BTC_DEPOSIT_SWAP_SATS) {
		return {
			ok: false,
			error: `A swap paid with Bitcoin needs at least ${MIN_BTC_DEPOSIT_SWAP_SATS / 1e8} BTC, so a refund can always cover its network fee.`
		};
	}

	const params = new URLSearchParams({ swap_to: recipient, swap_asset_out: input.toCoin });
	if (destinationChain) params.set('destination_chain', destinationChain);
	if (destinationChain === 'ETH' && input.toCoin === Coin.eth.value && input.payoutGasLimit) {
		params.set('payout_gas_limit', String(input.payoutGasLimit));
	}

	if (senderRefunds) {
		// The contract refunds the address that sent the BTC (it proves it): no
		// refund address to give, and a hive: one would not be used. A Bitcoin
		// wallet login's own address still goes along, as a fallback when the
		// sending transaction cannot be proven.
		const refundTo = (input.refundTo ?? '').trim();
		const refundNetwork = btcAddressNetwork(refundTo);
		if (
			refundNetwork &&
			(input.testnet === undefined || refundNetwork === (input.testnet ? 'testnet' : 'mainnet'))
		) {
			params.set('refund_to', refundTo);
		}
		const min = (input.minAmountOut ?? '').trim();
		if (!/^[0-9]+$/.test(min) || /^0+$/.test(min)) {
			return {
				ok: false,
				error: 'The quote is not ready yet: wait for the minimum amount received, then try again.'
			};
		}
		params.set('min_amount_out', min);
		return { ok: true, instruction: params.toString(), recipient };
	}

	if (input.refundsActive ?? DEPOSIT_SWAP_REFUNDS_ACTIVE) {
		// The contract sends a swap that does not complete back to refund_to; a
		// payout on Magi or Hive settles in the swap itself, so a Bitcoin refund
		// address is enough (the mapping bot and the contract apply the same rule).
		const refundTo = (input.refundTo ?? '').trim();
		const hiveRefund = refundTo.startsWith('hive:');
		const refundNetwork = hiveRefund ? null : btcAddressNetwork(refundTo);
		if (!hiveRefund && !refundNetwork) {
			return {
				ok: false,
				error:
					'A swap paid with Bitcoin needs a refund address: sign in with your Bitcoin wallet or your Hive account.'
			};
		}
		if (
			refundNetwork &&
			input.testnet !== undefined &&
			refundNetwork !== (input.testnet ? 'testnet' : 'mainnet')
		) {
			return {
				ok: false,
				error: `That refund address is for Bitcoin ${refundNetwork}, but this swap is on ${
					input.testnet ? 'testnet' : 'mainnet'
				}.`
			};
		}
		params.set('refund_to', refundTo);
		// Without a minimum the swap runs at whatever price it finds an hour later
		// (the deposit needs its confirmations first): never issue an address
		// without one.
		const min = (input.minAmountOut ?? '').trim();
		if (!/^[0-9]+$/.test(min) || /^0+$/.test(min)) {
			return {
				ok: false,
				error: 'The quote is not ready yet: wait for the minimum amount received, then try again.'
			};
		}
		params.set('min_amount_out', min);
	}
	return { ok: true, instruction: params.toString(), recipient };
}

/**
 * Ask the mapping bot (through Altera's same-origin proxy) for the deposit
 * address bound to `instruction`. Throws a readable Error on any failure.
 */
export async function requestBtcSwapDepositAddress(
	instruction: string,
	network: 'mainnet' | 'testnet',
	fetchImpl: typeof fetch = fetch
): Promise<string> {
	const res = await fetchImpl('/api/mapping-bot', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ instruction, network })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Mapping bot error (${res.status}): ${text}`);
	}
	const { address } = (await res.json()) as { address?: string };
	if (!address) throw new Error('Mapping bot returned no address');
	return address;
}

/**
 * Whether a Hive account exists. A payout to a name Hive has no account for
 * fails at the gateway and holds every Hive withdrawal behind it (NEW-GW-2), so
 * an address is never issued for one. Throws if Hive cannot be asked.
 */
export async function hiveAccountExists(
	name: string,
	getAccounts?: (names: string[]) => Promise<unknown[]>
): Promise<boolean> {
	const lookup =
		getAccounts ??
		(async (names: string[]) => {
			const { DHive } = await import('$lib/magiTransactions/dhive');
			return DHive.database.getAccounts(names);
		});
	const found = await lookup([name.replace(/^hive:/, '').replace(/^@/, '')]);
	return Array.isArray(found) && found.length > 0;
}
