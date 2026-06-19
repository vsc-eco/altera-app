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
 * sentinel, verifyAddressSignature returns `kind = 'unconfigured'`,
 * which triggers DashLogin's yellow warn-panel: the panel surfaces
 * that cryptographic verification was unavailable for this session,
 * NOT a comparison directive (the address-fingerprint is per-session
 * and has no static published value to compare against — audit
 * R19-SEC-fingerprint-warn-panel-no-canonical-source-exists). Pinning
 * this pubkey before mainnet is the only way to get the green
 * 'verified' badge + the fail-closed 'invalid' branch active.
 */
export const isServiceSignerPubkey: string = publicEnv.PUBLIC_IS_SERVICE_SIGNER_PUBKEY || '';

/**
 * Which Dash network the IS service binds to. Drives the
 * CAIP-2-genesis-hex prefix used in the DashDID.
 *
 * Round-3 audit OP-009: cross-checks against PUBLIC_IS_SERVICE_URL.
 * Round-4 audit R4-CSM-08: replaced the substring 'testnet' heuristic
 * with an explicit allow-list of known testnet host suffixes. The old
 * heuristic both false-positived (a mainnet host with 'testnet' in a
 * path) and false-negatived (a testnet host without the literal
 * substring, e.g. is.staging-magi.example).
 *
 * The single source-of-truth for network resolution is now
 * PUBLIC_DASH_NETWORK; the URL check is best-effort defense in depth
 * and runs only when the hostname matches one of the known suffixes.
 */
const TESTNET_HOST_SUFFIXES = [
	'is-service-testnet.okinoko.io',
	'.testnet.okinoko.io',
	'.dev.okinoko.io'
];

// Mirrors the testnet naming pattern minus the `-testnet` suffix.
// If the production deployment picks a different hostname (e.g.
// `is.okinoko.io` or behind a CDN like `is.magi.eco`), update this
// list at the same time as flipping the production env's
// PUBLIC_IS_SERVICE_URL — resolveDashNetwork cross-checks
// PUBLIC_DASH_NETWORK against this suffix list and will throw
// at first /login render if they disagree.
const MAINNET_HOST_SUFFIXES: string[] = [
	'is-service.okinoko.io',
	'.mainnet.okinoko.io',
];

function urlHostnameSuffixMatches(url: string, suffixes: string[]): boolean {
	let hostname: string;
	try {
		hostname = new URL(url).hostname.toLowerCase();
	} catch {
		return false;
	}
	return suffixes.some((s) => {
		const norm = s.toLowerCase();
		if (norm.startsWith('.')) return hostname.endsWith(norm) || hostname === norm.slice(1);
		return hostname === norm;
	});
}

function resolveDashNetwork(): 'mainnet' | 'testnet' {
	const raw = publicEnv.PUBLIC_DASH_NETWORK;
	let network: 'mainnet' | 'testnet';
	if (raw === 'mainnet') {
		network = 'mainnet';
	} else if (raw === 'testnet') {
		network = 'testnet';
	} else if (raw === undefined || raw === '') {
		// Operator must set the network explicitly. The previous
		// silent-fall-back-to-testnet caused mainnet deploys to issue
		// wrong-DID-namespace identities.
		throw new Error(
			`PUBLIC_DASH_NETWORK must be set explicitly to 'mainnet' or 'testnet'. ` +
				`No default is safe: mainnet defaults silently fall back to testnet, ` +
				`which authenticates users into the wrong-DID namespace.`
		);
	} else {
		throw new Error(
			`PUBLIC_DASH_NETWORK must be 'mainnet' or 'testnet'; got ${JSON.stringify(raw)}`
		);
	}
	const urlMatchesTestnet = urlHostnameSuffixMatches(isServiceUrl, TESTNET_HOST_SUFFIXES);
	const urlMatchesMainnet = urlHostnameSuffixMatches(isServiceUrl, MAINNET_HOST_SUFFIXES);
	if (urlMatchesTestnet && network === 'mainnet') {
		throw new Error(
			`PUBLIC_DASH_NETWORK=mainnet but PUBLIC_IS_SERVICE_URL (${isServiceUrl}) ` +
				`matches a known testnet host suffix. Fix one of the two.`
		);
	}
	if (urlMatchesMainnet && network === 'testnet') {
		throw new Error(
			`PUBLIC_DASH_NETWORK=testnet but PUBLIC_IS_SERVICE_URL (${isServiceUrl}) ` +
				`matches a known mainnet host suffix. Fix one of the two.`
		);
	}
	// Audit M3 (5.9) + M4 (6.0): mainnet deploys must NOT be allowed to
	// run with the verifier in 'unconfigured' fail-open mode. If the
	// IS-service is on a mainnet host AND the frontend has no pinned
	// signer pubkey, the modal shows the yellow "Verification not
	// configured" warn-panel and accepts the deposit-address binding
	// on faith. On mainnet that means real Dash deposits trust the
	// network identity. Refuse to render until the operator wires a
	// real Ed25519 pubkey via PUBLIC_IS_SERVICE_SIGNER_PUBKEY (which
	// also disables the HMAC dev-stub path in signature.ts).
	if (network === 'mainnet' && (!isServiceSignerPubkey || isServiceSignerPubkey.startsWith('hmac:'))) {
		throw new Error(
			`PUBLIC_DASH_NETWORK=mainnet but PUBLIC_IS_SERVICE_SIGNER_PUBKEY is ` +
				`${isServiceSignerPubkey ? 'an HMAC dev-stub' : 'unset'}. ` +
				`Production mainnet deploys MUST publish the IS-service's asymmetric ` +
				`signer pubkey (ed25519:<hex>) so the client can verify the address ` +
				`signature — without it, the yellow 'Verification not configured' ` +
				`warn-panel accepts the deposit-address binding on faith.`
		);
	}
	return network;
}

/**
 * Lazy-resolved dashNetwork — round-5 audit R5-OP-01. The previous
 * module-load throw blew up /login on every existing Altera deploy
 * the moment R4-CSM-08 landed, before operators could update env. The
 * resolver still throws on misconfig but only when DashLogin actually
 * needs the value (first read calls getDashNetwork()), so unrelated
 * routes keep working and the failure mode is a single broken modal
 * rather than a global hard-crash.
 */
let _dashNetwork: 'mainnet' | 'testnet' | undefined;
export function getDashNetwork(): 'mainnet' | 'testnet' {
	if (_dashNetwork !== undefined) return _dashNetwork;
	// Round-6 audit R6-OP-02: don't cache the error. A misconfig +
	// hot-reload (or operator fix-without-tab-reload) used to leave
	// every subsequent call throwing the cached error forever. Now
	// each call re-runs resolveDashNetwork; the success path still
	// memoizes via _dashNetwork. Throws are cheap (string compares).
	const v = resolveDashNetwork();
	_dashNetwork = v;
	return v;
}


