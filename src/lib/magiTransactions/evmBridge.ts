/**
 * ETH and USDC on Magi live on ONE contract, the EVM bridge (unlike BTC, which
 * has a contract to itself), so every call that names a mapped asset on it —
 * an allowance, a balance key — must also say which asset.
 */
import { getAddress } from 'viem';
import { Coin } from '$lib/sendswap/utils/sendOptions';

/** True for the assets the EVM bridge holds (ETH, USDC). */
export function isEvmBridgeCoin(coin: Coin | undefined): boolean {
	return coin?.value === Coin.eth.value || coin?.value === Coin.usdc.value;
}

const EIP155_PREFIX = 'did:pkh:eip155:1:';

/**
 * The bridge keys an Ethereum account by its EIP-55 checksummed DID
 * (evm-mapping-contract crypto.CanonicalIdentity); any other identity
 * (hive:alice) as given.
 */
export function canonicalIdentity(did: string): string {
	if (!did.toLowerCase().startsWith(EIP155_PREFIX)) return did;
	try {
		return EIP155_PREFIX + getAddress(did.slice(EIP155_PREFIX.length));
	} catch {
		return did;
	}
}

/** The bridge's ledger balance key: "a-" + identity + "-" + asset (balance.go balanceKey). */
export function evmBalanceKey(did: string, asset: string): string {
	return `a-${canonicalIdentity(did)}-${asset}`;
}
