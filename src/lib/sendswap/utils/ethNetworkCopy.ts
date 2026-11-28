import { Network } from './sendOptions';

/**
 * The wrong-network wording, in one place. ETH and USDC on Magi come only from,
 * and are paid out only on, Ethereum Mainnet (Sepolia on testnet). An EVM
 * address is the same on every EVM chain, so the bridge's address, or a payout
 * address, on BSC, Base or Arbitrum is somewhere else: what is sent there is
 * not credited, and the bridge cannot send it back (it signs only for its own
 * chain).
 */
export const ETH_NETWORK = Network.ethMainnet.label;

/** Under a payout address: an exchange gives a different address per network. */
export const ETH_PAYOUT_NOTE = 'For an exchange, use its Ethereum (ERC-20) deposit address.';
