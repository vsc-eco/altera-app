/**
 * The network a bridged pool asset lives on, named under the pool's pair.
 *
 * ETH and USDC on Magi are mapped by the EVM bridge from Ethereum (Sepolia on
 * testnet) and from nowhere else. An EVM address is the same on every EVM
 * chain, so ETH or USDC sent to the bridge on another one (BSC, Base,
 * Arbitrum...) lands at an address the bridge never reads and can never send
 * back from (it signs only transactions for its own chain id). Naming the
 * network next to the pool says which ETH and USDC these are.
 */

/** Pool symbols (upper case, as poolsData builds them) bridged from Ethereum. */
const ETHEREUM_ASSETS: ReadonlySet<string> = new Set(['ETH', 'USDC']);

/** Chain 1 as wallets name it (MetaMask, chainlist.org: "Ethereum Mainnet"). */
const NETWORKS: Readonly<Record<number, string>> = {
	1: 'Ethereum mainnet',
	11155111: 'Sepolia testnet'
};

/** The network to show for a pool, or null when no side of it is bridged from
 *  Ethereum. `chainId` is the bridge's chain (constants.ETH_CHAIN_ID). */
export function poolNetworkLabel(symbols: readonly string[], chainId: number): string | null {
	if (!symbols.some((s) => ETHEREUM_ASSETS.has(s.toUpperCase()))) return null;
	return NETWORKS[chainId] ?? null;
}
