/**
 * Address-signature verification.
 *
 * The IS service signs (depositAddress || 0x00 || instruction) with a
 * pinned key whose public half is configured via
 * PUBLIC_IS_SERVICE_SIGNER_PUBKEY (see config.ts).
 *
 * v1 ships with no pubkey by default — the IS service uses an HMAC-SHA256
 * stub which the frontend can't verify without sharing the symmetric
 * secret (spec §5.7 explicitly calls this out as dev-only). When no
 * pubkey is configured, the verifier returns 'unconfigured' and DashLogin
 * surfaces a yellow "Verification not configured" warn-panel telling the
 * user crypto-verification was unavailable for this session. There is NO
 * fingerprint to fall back to — the on-screen address fingerprint is per-
 * session-internal (regenerated every session) and no canonical operator-
 * published value exists to compare it against (audit R19-SEC-fingerprint-
 * warn-panel-no-canonical-source-exists).
 *
 * Production wiring (TODO):
 *   1. Move the IS service to an HSM/KMS asymmetric signer (Ed25519 or
 *      BLS).
 *   2. Publish the public half via PUBLIC_IS_SERVICE_SIGNER_PUBKEY.
 *   3. Pick the matching verify-* helper below and wire it into
 *      verifyAddressSignature.
 *
 * The seam below — verifyAddressSignature returning a tagged union — is
 * what the rest of the app binds to, so the upgrade is local once a
 * scheme is picked.
 */

export type SignatureVerdict =
	| { kind: 'valid' }
	| { kind: 'invalid' }
	| { kind: 'unconfigured' } // no pubkey pinned — DashLogin renders the yellow "Verification not configured" warn-panel; NO fingerprint comparison is possible (audit R19-SEC-fingerprint-warn-panel-no-canonical-source-exists)
	| { kind: 'unsupported'; reason: string };

/**
 * Verify (depositAddress || \0 || instruction) signed by the IS service.
 *
 * Returns 'unconfigured' when no pubkey is pinned. Returns 'unsupported'
 * for the v1 HMAC stub (the frontend can't verify HMAC without sharing
 * the secret). Returns 'valid' / 'invalid' once an asymmetric signer is
 * wired.
 */
export async function verifyAddressSignature(opts: {
	depositAddress: string;
	instruction: string;
	signatureB64: string;
	pinnedPubkey: string;
}): Promise<SignatureVerdict> {
	const { pinnedPubkey, depositAddress, instruction, signatureB64 } = opts;
	if (!pinnedPubkey) return { kind: 'unconfigured' };

	// The Ed25519/BLS pubkey format detection — pick by length once we
	// publish a real key. Until then, refuse to verify and surface the
	// 'unsupported' verdict so DashLogin renders its yellow warn-panel
	// (no fingerprint comparison; audit R19-SEC-fingerprint-warn-panel-
	// no-canonical-source-exists).
	if (pinnedPubkey.startsWith('hmac:')) {
		return {
			kind: 'unsupported',
			reason: 'HMAC stub cannot be verified client-side (spec §5.7 dev mode)'
		};
	}

	if (pinnedPubkey.startsWith('ed25519:')) {
		try {
			const ok = await verifyEd25519(
				pinnedPubkey.slice('ed25519:'.length),
				depositAddress,
				instruction,
				signatureB64
			);
			return { kind: ok ? 'valid' : 'invalid' };
		} catch (e) {
			return {
				kind: 'unsupported',
				reason: 'ed25519 verifier failed: ' + (e instanceof Error ? e.message : 'unknown')
			};
		}
	}

	return {
		kind: 'unsupported',
		reason: 'unknown pubkey scheme; expected hmac:/ed25519:/bls: prefix'
	};
}

/**
 * Build the message bytes the IS service signs: `addr || 0x00 || instruction`.
 * Exposed for tests; mirrors handlers.go's AddressSignerHMAC.Sign.
 */
export function addressSignatureMessage(depositAddress: string, instruction: string): Uint8Array {
	const enc = new TextEncoder();
	const a = enc.encode(depositAddress);
	const i = enc.encode(instruction);
	const out = new Uint8Array(a.length + 1 + i.length);
	out.set(a, 0);
	out[a.length] = 0;
	out.set(i, a.length + 1);
	return out;
}

/**
 * Ed25519 verifier via WebCrypto. WebCrypto's Ed25519 support landed in
 * Chrome 137 / Safari 18 / Firefox 130 — falls back to throwing on older
 * browsers, which verifyAddressSignature catches as 'unsupported'.
 */
async function verifyEd25519(
	pubkeyHex: string,
	depositAddress: string,
	instruction: string,
	signatureB64: string
): Promise<boolean> {
	const pubBytes = hexToBytes(pubkeyHex);
	const sigBytes = base64ToBytes(signatureB64);
	const msgBytes = addressSignatureMessage(depositAddress, instruction);
	const key = await crypto.subtle.importKey(
		'raw',
		pubBytes as unknown as ArrayBuffer,
		{ name: 'Ed25519' },
		false,
		['verify']
	);
	return await crypto.subtle.verify(
		{ name: 'Ed25519' },
		key,
		sigBytes as unknown as ArrayBuffer,
		msgBytes as unknown as ArrayBuffer
	);
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) throw new Error('hex string must have even length');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function base64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
