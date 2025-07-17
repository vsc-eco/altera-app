import { encode } from '@ipld/dag-cbor';
import { encodePayload } from 'dag-jose-utils';
import type { Signer } from './client';
import { type Config, signTypedData, getAccount } from '@wagmi/core';
import { convertCBORToEIP712TypedData } from './cbor_to_eip712_converter';
import type { VSCTransactionSigningShell, Client } from './client';

export const wagmiSigner: Signer<[Config]> = async (
	signingShell: VSCTransactionSigningShell,
	client: Client,
	config: Config
) => {
	// Validate inputs
	if (!signingShell || !client || !config) {
		throw new Error('Missing required parameters for signing');
	}

	// Check wallet connection
	const account = getAccount(config);
	if (!account.isConnected || !account.address) {
		throw new Error('Wallet not connected. Please connect your wallet first.');
	}

	// Validate signing shell structure
	if (!signingShell.__t || !signingShell.__v || !signingShell.headers || !signingShell.tx) {
		throw new Error('Invalid signing shell structure');
	}

	console.log('=== Signing Transaction ===');
	console.log('Connected wallet:', account.address);
	console.log('Client user ID:', client.userId);
	console.log('Transaction shell:', JSON.stringify(signingShell, null, 2));

	try {
		const encodedShell = encode(signingShell);
		const types = convertCBORToEIP712TypedData('vsc.network', encodedShell, 'tx_container_v0');

		console.log('EIP712 typed data:', JSON.stringify(types, null, 2));

		const signature = await signTypedData(config, types as any);

		console.log('User signature:', signature);

		// backend wants type {alg, kid, sig}, even though struct can take {t, s}
		const sigs = [
			{
				alg: 'EdDSA',
				kid: client.userId,
				sig: signature
			}
		];

		const rawTx = (await encodePayload(signingShell)).linkedBlock;

		// console.log('Raw transaction encoded, length:', rawTx.length);
		console.log('=== Signing Complete ===');

		return {
			sigs,
			rawTx
		};
	} catch (error) {
		console.error('=== Signing Failed ===');
		console.error('Error details:', error);

		if (error instanceof Error) {
			if (error.message.includes('User rejected')) {
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
