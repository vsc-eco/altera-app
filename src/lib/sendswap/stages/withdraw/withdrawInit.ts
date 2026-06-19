/**
 * Per-destination txState initialization for the withdraw flow.
 *
 * EXTRACTED from the `$effect` blocks in WithdrawOptions.svelte (the
 * hiveMainnetOpen / btcMainnetOpen / lightningTransferOpen effects) so the
 * new WithdrawTimeline picker and the legacy WithdrawOptions menu initialize
 * `WithdrawTxState` through the SAME code path → identical broadcast payload
 * by construction (the txState → decideBroadcast → sendUtils pipeline is
 * pinned by the existing withdraw flow tests).
 *
 * Withdraw is asset-first: the user picks the Magi asset in step 1, so the
 * chosen coin is passed in here (unlike the legacy menu, which auto-detected
 * HIVE-vs-HBD by balance). Source is always Magi; the destination only sets
 * `to`'s network. The functions mutate the passed state object's `from`/`to`,
 * matching the original effects mutating the context txState.
 */
import { getToOption, Coin, Network, type CoinOnNetwork } from '../../utils/sendOptions';

/** The destinations the withdraw picker offers. */
export type WithdrawDestination = 'hive_mainnet' | 'btc_mainnet' | 'lightning' | 'coinbase';

/** Minimal slice of WithdrawTxState the init functions touch. */
export type WithdrawInitState = {
	from: CoinOnNetwork | undefined;
	to: CoinOnNetwork | undefined;
};

/**
 * Hive Mainnet withdraw — mirror of WithdrawOptions' `hiveMainnetOpen` effect,
 * but with the asset chosen up-front (HIVE or HBD) instead of balance-detected.
 * rail derives `magi → hiveMainnet`.
 */
export function initHiveMainnetWithdraw(txState: WithdrawInitState, assetCoin: Coin): void {
	txState.from = { coin: assetCoin, network: Network.magi };
	txState.to = { coin: assetCoin, network: Network.hiveMainnet };
}

/**
 * Bitcoin Mainnet withdraw — mirror of WithdrawOptions' `btcMainnetOpen`
 * effect. rail derives `magi → btcMainnet`.
 */
export function initBtcMainnetWithdraw(txState: WithdrawInitState): void {
	txState.from = { coin: Coin.btc, network: Network.magi };
	txState.to = { coin: Coin.btc, network: Network.btcMainnet };
}

/**
 * Lightning / Keepsats withdraw — mirror of WithdrawOptions'
 * `lightningTransferOpen` effect. The `to` coin comes from `getToOption` (BTC
 * isn't necessarily in the from-list with a lightning network). rail derives
 * to lightning from `to.network = lightning`.
 */
export function initLightningWithdraw(txState: WithdrawInitState): void {
	const btcTo = getToOption(Coin.btc.value);
	txState.from = { coin: Coin.btc, network: Network.magi };
	txState.to = btcTo
		? { coin: btcTo.coin, network: Network.lightning }
		: { coin: Coin.btc, network: Network.lightning };
}

/**
 * Dispatch helper for the picker: initialize txState for the chosen
 * destination. Coinbase intentionally does nothing (coming soon).
 */
export function initWithdrawStateForDestination(
	txState: WithdrawInitState,
	destination: WithdrawDestination,
	assetCoin: Coin
): void {
	if (destination === 'hive_mainnet') initHiveMainnetWithdraw(txState, assetCoin);
	else if (destination === 'btc_mainnet') initBtcMainnetWithdraw(txState);
	else if (destination === 'lightning') initLightningWithdraw(txState);
}
