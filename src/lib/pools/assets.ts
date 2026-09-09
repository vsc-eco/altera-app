/**
 * Which assets the DEX treats as built-in.
 *
 * Lives in its own module so both `poolsData` (which classifies pools) and
 * `tokens/customTokens` (which discovers everything else) can use it without
 * importing each other — poolsData needs custom-token decimals to format its
 * rows, so a shared constant here is what keeps that from becoming a cycle.
 */

/** The Hive L1 coins plus the mapped chain assets. Anything else in a pair is
 *  a token registered through the Magi token contract — i.e. a custom token.
 *  Add new mapped assets here as they land, or their pools will be treated as
 *  custom throughout the UI. */
const NATIVE_POOL_ASSETS: ReadonlySet<string> = new Set(['HIVE', 'HBD', 'BTC']);

/** True for the DEX's built-in assets; false for Magi custom tokens. */
export function isNativeAsset(symbol: string): boolean {
	return NATIVE_POOL_ASSETS.has(symbol.toUpperCase());
}
