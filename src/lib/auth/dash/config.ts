import { env as publicEnv } from '$env/dynamic/public';

/**
 * Base URL for the Magi IS-service (DashPay InstantSend login). Override
 * via PUBLIC_IS_SERVICE_URL when deploying against a non-default host
 * (e.g. staging). When unset, defaults to the testnet IS service.
 *
 * Production main-net wiring will fall back to the prod host once the
 * Magi witness fleet finishes wiring the libp2p-attestation flow in.
 */
export const isServiceUrl: string =
	publicEnv.PUBLIC_IS_SERVICE_URL || 'https://is-service-testnet.okinoko.io';

/**
 * Pinned IS-service public key (hex, BLS or ECDSA depending on what the
 * Go service hands us per §5.7). The browser uses it to verify the
 * `addressSignature` field returned by /session/start.
 *
 * v1 ships with a placeholder — when unset OR equal to the placeholder
 * sentinel, the frontend falls back to the address-fingerprint visual
 * check (see addressFingerprint in isClient.ts). Both should be wired
 * before mainnet.
 */
export const isServiceSignerPubkey: string = publicEnv.PUBLIC_IS_SERVICE_SIGNER_PUBKEY || '';

/**
 * Which Dash network the IS service binds to. Drives the
 * CAIP-2-genesis-hex prefix used in the DashDID.
 *
 * Round-3 audit OP-009: cross-checks against PUBLIC_IS_SERVICE_URL. A
 * mainnet deploy that forgot to set PUBLIC_DASH_NETWORK previously
 * silently fell back to testnet — every Dash user then authenticated
 * into the wrong-DID namespace against the mainnet contract. This
 * module now throws at module load if env is inconsistent so the
 * misconfig surfaces at deploy time, not on first user login.
 */
function resolveDashNetwork(): 'mainnet' | 'testnet' {
	const raw = publicEnv.PUBLIC_DASH_NETWORK;
	const urlLooksTestnet = isServiceUrl.includes('testnet');
	let network: 'mainnet' | 'testnet';
	if (raw === 'mainnet') {
		network = 'mainnet';
	} else if (raw === 'testnet' || raw === undefined || raw === '') {
		network = 'testnet';
	} else {
		throw new Error(
			`PUBLIC_DASH_NETWORK must be 'mainnet' or 'testnet'; got ${JSON.stringify(raw)}`
		);
	}
	if (urlLooksTestnet && network === 'mainnet') {
		throw new Error(
			`PUBLIC_DASH_NETWORK=mainnet but PUBLIC_IS_SERVICE_URL (${isServiceUrl}) looks like a testnet host. ` +
				`Set PUBLIC_IS_SERVICE_URL to a mainnet IS-service endpoint, or set PUBLIC_DASH_NETWORK=testnet.`
		);
	}
	if (!urlLooksTestnet && network === 'testnet' && raw !== 'testnet') {
		// URL looks mainnet but network defaulted to testnet because
		// PUBLIC_DASH_NETWORK is unset. Force operator intent.
		throw new Error(
			`PUBLIC_IS_SERVICE_URL (${isServiceUrl}) doesn't look like a testnet host but ` +
				`PUBLIC_DASH_NETWORK is unset. Set PUBLIC_DASH_NETWORK=mainnet (or testnet) explicitly.`
		);
	}
	return network;
}
export const dashNetwork: 'mainnet' | 'testnet' = resolveDashNetwork();

