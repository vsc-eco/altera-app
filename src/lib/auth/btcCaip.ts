/**
 * CAIP-2 chain identifiers for Bitcoin networks.
 *
 * A CAIP-2 chain ID is the first 32 hex characters of the chain's genesis
 * block hash. These constants are used to build `did:pkh:bip122:...` DIDs —
 * the go-vsc-node verifier (see `lib/dids/btc.go`) accepts mainnet; the
 * testnet hash is carried end-to-end from the Altera auth layer.
 */
export const BTC_MAINNET_CAIP = '000000000019d6689c085ae165831e93';
export const BTC_TESTNET_CAIP = '000000000933ea01ad0ee984209779ba';
