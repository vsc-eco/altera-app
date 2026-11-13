import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { getDidFromUsername } from '$lib/getAccountName';

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

	const params = new URLSearchParams({ swap_to: recipient, swap_asset_out: input.toCoin });
	if (destinationChain) params.set('destination_chain', destinationChain);
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
