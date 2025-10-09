import * as bitcoin from 'bitcoinjs-lib';
import * as crypto from 'crypto';

const PUBLICKEY = '';

function currentUserBtcDepositAddress(did: string) {
	let depositInstruction = new URLSearchParams({ deposit_to: did }).toString();
	const tag = crypto.hash('sha256', depositInstruction);

	let { address } = createP2WSHAddress(PUBLICKEY, tag);

	return address;
}

function createP2WSHAddress(
	publicKey: string,
	tag: string,
	network: bitcoin.Network = bitcoin.networks.bitcoin
): {
	address: string;
	witnessScript: Uint8Array<ArrayBufferLike>;
	scriptHash: Uint8Array<ArrayBufferLike>;
} {
	// Convert public key to Buffer if it's a hex string
	const pubKeyBuffer = Buffer.from(publicKey, 'hex');

	// Create a witness script that includes the tag and public key
	// This is a simple example: OP_PUSHDATA(tag) OP_DROP <pubkey> OP_CHECKSIG
	const tagBuffer = Buffer.from(tag, 'hex');

	const witnessScript = bitcoin.script.compile([
		pubKeyBuffer,
		bitcoin.opcodes.OP_CHECKSIGVERIFY,
		tagBuffer
	]);

	// Create P2WSH payment object
	const p2wsh = bitcoin.payments.p2wsh({
		redeem: {
			output: witnessScript,
			network: network
		},
		network: network
	});

	if (!p2wsh.address) {
		throw new Error('Failed to generate P2WSH address');
	}

	return {
		address: p2wsh.address,
		witnessScript: witnessScript,
		scriptHash: p2wsh.hash!
	};
}
