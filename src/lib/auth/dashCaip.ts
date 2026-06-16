/**
 * CAIP-2 chain identifiers for Dash networks.
 *
 * A CAIP-2 chain ID is the first 32 hex characters of the chain's genesis
 * block hash. These constants MUST match go-vsc-node's lib/dids/dash.go
 * (DashDIDPrefix / DashTestnetDIDPrefix) and the dash-mapping-contract's
 * dashGenesisCAIP2Hex helper — drift breaks the cross-layer identity
 * binding (round-2 audit D2-DESIGN-01).
 *
 * The contract derives DashDID as
 *   did:pkh:bip122:<chain-genesis-hex>:<addr>
 * The literal token "dash" (which an earlier altera draft used) does
 * NOT match; every contract-state lookup by that malformed DID returns
 * empty.
 */
export const DASH_MAINNET_CAIP = '00000ffd590b1485b3caadc19b22e637';
export const DASH_TESTNET_CAIP = '00000bafbc94add76cb75e2ec9289483';

/**
 * Build the canonical DashDID for an L1 address on the given network.
 * Returns the same string the contract's ResolveSenderDashDID produces.
 */
export function buildDashDID(network: 'mainnet' | 'testnet', address: string): string {
	const caip = network === 'mainnet' ? DASH_MAINNET_CAIP : DASH_TESTNET_CAIP;
	return `did:pkh:bip122:${caip}:${address}`;
}
