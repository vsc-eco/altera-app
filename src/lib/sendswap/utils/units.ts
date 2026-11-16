/**
 * BTC ↔ satoshi.
 *
 * ⚠️ Moved to `$lib/calc` (§1 Units and decimals). Re-exported here so the
 * send/swap code keeps its import path.
 */
export { satsToBtc, btcToSats } from '$lib/calc';
