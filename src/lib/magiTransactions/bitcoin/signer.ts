import { encodePayload } from 'dag-jose-utils';
import type { Signer, VSCTransactionSigningShell, Client } from '../eth/client';
import { modal } from '$lib/auth/reown';

/**
 * BTC signer for VSC transactions.
 *
 * 1. Encodes the signing shell to DAG-CBOR via encodePayload()
 * 2. Signs the CID string via the connected BTC wallet (through AppKit)
 *    - SegWit (bc1q) addresses: returns BIP-322 "simple" signature (~107 bytes)
 *    - Legacy addresses: returns BIP-137 compact signature (65 bytes)
 * 3. Passes the raw base64 signature to the backend, which handles both formats
 */
export const btcSigner: Signer<[]> = async (
	signingShell: VSCTransactionSigningShell,
	client: Client
) => {
	if (!modal) {
		throw new Error('AppKit modal not initialized');
	}

	const address = modal.getAddress();
	if (!address) {
		throw new Error('BTC wallet not connected');
	}

	try {
		// Encode signing shell to DAG-CBOR and compute CID
		const encoded = await encodePayload(signingShell);
		const cidString = encoded.cid.toString();

		// Sign via the currently connected wallet's AppKit provider
		const provider = modal.getProvider<{
			signMessage(p: {
				message: string;
				address: string;
				protocol?: string;
			}): Promise<string>;
		}>('bip122');
		if (!provider?.signMessage) {
			throw new Error('No Bitcoin signing provider available');
		}
		const rawSignature = await provider.signMessage({
			message: cidString,
			address,
			protocol: 'ECDSA'
		});

		// Normalize BIP-137 recovery flag for SegWit signatures.
		// Backend expects recovery byte in [27-34], but SegWit wallets (e.g. Xverse)
		// return the full BIP-137 header: [35-38] for P2SH-P2WPKH, [39-42] for
		// native P2WPKH (bc1q). Both are always compressed, so we map them into
		// the compressed P2PKH range [31-34] which the backend understands.
		const sigBytes = Uint8Array.from(atob(rawSignature), (c) => c.charCodeAt(0));
		if (sigBytes.length === 65 && sigBytes[0] >= 35) {
			sigBytes[0] = sigBytes[0] >= 39
				? sigBytes[0] - 8   // native SegWit [39-42] → [31-34]
				: sigBytes[0] - 4;  // P2SH-SegWit  [35-38] → [31-34]
		}
		const normalizedSignature = btoa(String.fromCharCode(...sigBytes));
		console.log(`BTC sig: ${sigBytes.length} bytes, recovery flag: ${sigBytes[0]}`);

		const sigs = [
			{
				// ES256K (secp256k1 ECDSA) — matches the actual BTC wallet signature
				// algorithm. Previously mislabeled as 'EdDSA'; backend dispatches by
				// DID prefix so the field is informational only.
				alg: 'ES256K',
				kid: client.userId,
				sig: normalizedSignature
			}
		];

		const rawTx = encoded.linkedBlock;

		return {
			sigs,
			rawTx
		};
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('User rejected') || error.message.includes('denied')) {
				throw new Error('Transaction was rejected by user');
			}
		}

		throw new Error(
			`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
};
