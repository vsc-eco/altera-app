import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { getDidFromUsername } from '$lib/getAccountName';
import { DEPOSIT_SWAP_REFUNDS_ACTIVE, MIN_BTC_DEPOSIT_SWAP_SATS } from '$lib/constants';

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
};

export type BtcSwapInstruction =
	| { ok: true; instruction: string; recipient: string }
	| { ok: false; error: string };

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

	let destinationChain: string | undefined;
	if (input.toNetwork === Network.hiveMainnet.value) {
		destinationChain = 'HIVE';
	} else if (input.toNetwork !== Network.magi.value) {
		return {
			ok: false,
			error: 'A swap paid with Bitcoin can settle on Magi or Hive only.'
		};
	}

	const raw = (input.recipient ?? '').trim().replace(/^@/, '');
	if (!raw) {
		return { ok: false, error: 'Enter a receiver.' };
	}
	const recipient = getDidFromUsername(raw);
	if (!recipient || !(recipient.startsWith('hive:') || recipient.startsWith('did:pkh:'))) {
		return { ok: false, error: `"${raw}" is not a valid receiver.` };
	}
	if (destinationChain === 'HIVE' && !recipient.startsWith('hive:')) {
		return { ok: false, error: 'Enter a Hive account to receive on Hive.' };
	}

	if (input.amountSats !== undefined && input.amountSats < MIN_BTC_DEPOSIT_SWAP_SATS) {
		return {
			ok: false,
			error: `A swap paid with Bitcoin needs at least ${MIN_BTC_DEPOSIT_SWAP_SATS / 1e8} BTC, so a refund can always cover its network fee.`
		};
	}

	const params = new URLSearchParams({ swap_to: recipient, swap_asset_out: input.toCoin });
	if (destinationChain) params.set('destination_chain', destinationChain);

	if (input.refundsActive ?? DEPOSIT_SWAP_REFUNDS_ACTIVE) {
		// The contract sends a swap that does not complete back to refund_to; a
		// payout on Magi or Hive settles in the swap itself, so a Bitcoin refund
		// address is enough (the mapping bot and the contract apply the same rule).
		const refundTo = (input.refundTo ?? '').trim();
		const hiveRefund = refundTo.startsWith('hive:');
		const btcRefund = /^(bc1|tb1|bcrt1|[123mn2])/.test(refundTo) && !hiveRefund;
		if (!hiveRefund && !btcRefund) {
			return {
				ok: false,
				error:
					'A swap paid with Bitcoin needs a refund address: sign in with your Bitcoin wallet or your Hive account.'
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
