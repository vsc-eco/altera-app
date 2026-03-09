import { encodePayload } from 'dag-jose-utils';
import type { Signer, VSCTransactionSigningShell, Client } from '../eth/client';
import { modal } from '$lib/auth/reown';

export const btcSigner: Signer = async (
	signingShell: VSCTransactionSigningShell,
	client: Client
) => {
	// Validate inputs
	if (!modal) {
		throw new Error('AppKit not initialized');
	}
	if (!signingShell || !client) {
		throw new Error('Missing required parameters for signing');
	}

	// Get connected BTC address from Reown modal
	const btcAddress = modal.getAddress();
	if (!btcAddress) {
		throw new Error('BTC wallet not connected. Please connect your wallet first.');
	}

	// Validate signing shell structure
	if (!signingShell.__t || !signingShell.__v || !signingShell.headers || !signingShell.tx) {
		throw new Error('Invalid signing shell structure');
	}

	try {
		// CBOR-encode the signing shell and get CID
		const encoded = await encodePayload(signingShell);
		const cidString = encoded.cid.toString();

		// Sign the CID string using Bitcoin Signed Message format via Reown
		const signature = await modal.request({
			method: 'signMessage',
			params: { message: cidString, address: btcAddress, protocol: 'ecdsa' }
		});

		const sig = typeof signature === 'string' ? signature : (signature as any).signature;

		const sigs = [
			{
				alg: 'BIP137',
				kid: btcAddress,
				sig
			}
		];

		const rawTx = encoded.linkedBlock;

		return {
			sigs,
			rawTx
		};
	} catch (error) {
		console.error('=== BTC Signing Failed ===');
		console.error('Error details:', error);

		if (error instanceof Error) {
			if (error.message.includes('User rejected') || error.message.includes('rejected')) {
				throw new Error('Transaction was rejected by user');
			} else if (error.message.includes('network')) {
				throw new Error('Network error during signing');
			}
		}

		throw new Error(
			`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
};
