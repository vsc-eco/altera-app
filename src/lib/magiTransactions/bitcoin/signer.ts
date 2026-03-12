import { encodePayload } from 'dag-jose-utils';
import type { Signer, VSCTransactionSigningShell, Client } from '../eth/client';
import { modal } from '$lib/auth/reown';

declare global {
	interface Window {
		LeatherProvider?: {
			request(
				method: string,
				params: Record<string, unknown>
			): Promise<{ result: { signature: string } }>;
		};
	}
}

/**
 * BTC signer for VSC transactions.
 *
 * 1. Encodes the signing shell to DAG-CBOR via encodePayload()
 * 2. Signs the CID string via Leather wallet
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

		// Sign via Leather's native RPC or AppKit provider
		let rawSignature: string;

		if (window.LeatherProvider) {
			const res = await window.LeatherProvider.request('signMessage', {
				message: cidString,
				protocol: 'ECDSA'
			});
			rawSignature = res.result.signature;
		} else {
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
			rawSignature = await provider.signMessage({
				message: cidString,
				address,
				protocol: 'ECDSA'
			});
		}

		// Pass raw signature directly — backend handles both BIP-137 and BIP-322
		const sigBytes = Uint8Array.from(atob(rawSignature), (c) => c.charCodeAt(0));
		console.log(`BTC sig: ${sigBytes.length} bytes (${sigBytes.length === 65 ? 'BIP-137' : 'BIP-322'})`);

		const sigs = [
			{
				alg: 'EdDSA',
				kid: client.userId,
				sig: rawSignature
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
