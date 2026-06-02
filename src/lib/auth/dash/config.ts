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
 * CAIP-2-genesis-hex prefix used in the DashDID. Defaults to testnet to
 * match the default isServiceUrl. Set via PUBLIC_DASH_NETWORK.
 */
export const dashNetwork: 'mainnet' | 'testnet' =
	publicEnv.PUBLIC_DASH_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

