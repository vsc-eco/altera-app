/**
 * The wallet's Assets actions — Transfer, Deposit, Withdraw.
 *
 * They sit once above the list rather than on every row: three icons per row
 * over five rows read as fifteen controls, and none of them is the thing the
 * reader came to the list for.
 *
 * `assetActionHref` can still name an asset (`?coin=`), which all three flows
 * read and resolve — so a link that knows which asset it means opens on that
 * asset. Nothing in the UI links that way at the moment; the header buttons
 * are deliberately asset-agnostic.
 *
 * The matrix below mirrors the flows:
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

/** Whether a flow can handle a given coin at all. */
export function supportsCoin(action: AssetAction, coinValue: string | undefined): boolean {
	return !!coinValue && SUPPORTED[action].includes(coinValue);
}

/**
 * Where an action goes: its wallet tab, optionally with an asset preselected.
 * A coin the flow cannot handle is dropped rather than passed on, so the link
 * still works and the flow picks its own default.
 */
export function assetActionHref(action: AssetAction, coinValue?: string): string {
	return supportsCoin(action, coinValue)
		? `/${action}?coin=${encodeURIComponent(coinValue!)}`
		: `/${action}`;
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
