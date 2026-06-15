/**
 * Audit-link URL builders for contract updates.
 *
 * The witness page surfaces "view raw" links per update so anyone can
 * independently verify what's about to ship:
 *   - new code (WASM) on an IPFS gateway
 *   - previous code (WASM) on an IPFS gateway (when known)
 *   - diff helper for the two CIDs
 *   - the proposer account on hivehub
 *   - the contract id on the VSC explorer
 *
 * The IPFS gateway is hardcoded — swap for a self-hosted gateway if
 * reliability becomes an issue.
 */

const IPFS_GATEWAY = 'https://ipfs.io/ipfs';

/**
 * Same semantics as client.ts's isVscTestnet, but self-contained: client.ts
 * runs localStorage reads at module scope, which crashes the jsdom Vitest
 * client project (Storage global without callable getItem). Reading the key
 * lazily through optional chaining keeps this module import-safe anywhere.
 */
function isTestnet(): boolean {
	try {
		return globalThis.localStorage?.getItem?.('vsc-network-id') === 'vsc-testnet';
	} catch {
		return false;
	}
}

/** Link to the proposer's Hive account profile. */
export function proposerTxUrl(account: string): string {
	// Strip "hive:" prefix if the proposer field includes it.
	const name = account.startsWith('hive:') ? account.slice(5) : account;
	return `https://hivehub.dev/@${encodeURIComponent(name)}`;
}

/** Contract page on the VSC explorer (testnet-aware base, same switch as
 *  getVscExplorerTxUrl). */
export function contractExplorerUrl(contractId: string): string {
	const base = isTestnet() ? 'https://magi-test.techcoderx.com' : 'https://vsc.techcoderx.com';
	return `${base}/contract/${contractId}`;
}

export function codeIpfsUrl(cid: string): string {
	return `${IPFS_GATEWAY}/${cid}`;
}

/**
 * Diff helper for two CIDs. There's no public WASM-diff tool integrated,
 * so today this just returns a search URL the witness can hand off. Wire
 * this to a real tool when one ships (e.g. a hosted wasm-decompiler
 * comparison, or a github source-vs-source link).
 */
export function codeDiffSearchUrl(previousCid: string, newCid: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(
		`ipfs diff ${previousCid} ${newCid}`
	)}`;
}
