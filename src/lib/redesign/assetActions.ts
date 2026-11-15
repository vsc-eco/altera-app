/**
 * The per-asset quick actions on the wallet's Assets list.
 *
 * Each row offers the things you can do with THAT asset, and each lands on
 * the matching wallet tab with the asset already chosen (`?coin=`). A row
 * only ever offers an action the flow behind it actually supports — an icon
 * that drops the reader on a page where their asset is not selectable is
 * worse than no icon.
 *
 * The three matrices below mirror the flows:
 *  - transfer  — `swapOptions.from`, the assets a transfer can send: HIVE,
 *                HBD, sHBD and BTC, all on Magi.
 *  - deposit   — `DepositTimeline`'s ASSETS, minus the disabled ETH chip.
 *  - withdraw  — `WithdrawTimeline`'s ASSET_DEFS.
 * sHBD is transfer-only on purpose: it stays transferable while earning, but
 * has no mainnet rail of its own to move in or out over.
 */
import { Coin } from '$lib/sendswap/utils/sendOptions';

export type AssetAction = 'transfer' | 'deposit' | 'withdraw';

/** Coin values each action can handle, as its own flow defines them. */
const SUPPORTED: Record<AssetAction, readonly string[]> = {
	transfer: [Coin.hive.value, Coin.hbd.value, Coin.shbd.value, Coin.btc.value],
	deposit: [Coin.hive.value, Coin.hbd.value, Coin.btc.value],
	withdraw: [Coin.hive.value, Coin.hbd.value, Coin.btc.value]
};

/** Display order, which is also the order the icons sit in on a row. */
export const ASSET_ACTIONS: readonly AssetAction[] = ['transfer', 'deposit', 'withdraw'];

export const ACTION_LABEL: Record<AssetAction, string> = {
	transfer: 'Transfer',
	deposit: 'Deposit',
	withdraw: 'Withdraw'
};

/** The actions offered for a coin, in display order. Unknown coins get none. */
export function actionsForCoin(coinValue: string | undefined): AssetAction[] {
	if (!coinValue) return [];
	return ASSET_ACTIONS.filter((action) => SUPPORTED[action].includes(coinValue));
}

/** Where an action icon goes: the wallet tab, with the asset preselected. */
export function assetActionHref(action: AssetAction, coinValue: string): string {
	return `/${action}?coin=${encodeURIComponent(coinValue)}`;
}

/**
 * Resolve a `?coin=` value against what a flow supports, so a hand-typed or
 * stale URL falls back to the flow's own default instead of selecting
 * nothing. Returns undefined when the param is absent or unusable.
 */
export function coinParamFor(
	action: AssetAction,
	param: string | null | undefined
): string | undefined {
	if (!param) return undefined;
	return SUPPORTED[action].includes(param) ? param : undefined;
}
