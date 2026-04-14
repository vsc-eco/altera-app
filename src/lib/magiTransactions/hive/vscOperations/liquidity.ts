import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId, DEX_ROUTER_CONTRACT_ID } from '../../../../client';

type LiquidityCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

/** Native (non-mapped) assets that need a `transfer.allow` intent so the
 *  router can `HiveDraw` them from the user. Mapped assets (BTC) move via
 *  the mapping contract's `transferFrom` and don't go through intents. */
function isNativeAsset(coinValue: string): boolean {
	return coinValue === Coin.hive.value || coinValue === Coin.hbd.value;
}

function buildIntents(
	amounts: { coinValue: string; rawAmount: string }[]
): Array<{ type: string; args: Record<string, string> }> {
	return amounts
		.filter((a) => isNativeAsset(a.coinValue))
		.map((a) => ({
			type: 'transfer.allow',
			args: { limit: a.rawAmount, token: a.coinValue }
		}));
}

function wrapVscCall(
	username: string,
	op: Record<string, unknown>
): CustomJsonOperation {
	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(op)
		}
	];
}

/**
 * Build the VSC custom_json op for adding liquidity. Always targets the
 * DEX router (`DEX_ROUTER_CONTRACT_ID`) with a `deposit` instruction. The
 * router pre-funds both sides:
 *   - native HIVE/HBD via HiveDraw + HiveTransfer (needs transfer.allow
 *     intents on this op)
 *   - mapped BTC via the mapping contract's transferFrom (needs a prior
 *     `approve` to the router on the BTC mapping contract — see
 *     `getBtcApproveOp` in swap.ts)
 *
 * Reference payload (asset0/asset1 in alphabetical order):
 *   { type: "deposit", version: "1.0.0",
 *     asset0: "hbd", asset1: "hive",
 *     amount0: "50000", amount1: "12345",
 *     recipient: "hive:user" }
 */
export function getAddLiquidityOp(
	username: string,
	amount0: CoinAmount<LiquidityCoin>,
	amount1: CoinAmount<LiquidityCoin>
): CustomJsonOperation {
	const caller = `hive:${username}`;

	// Normalize to alphabetical pool order (asset0 < asset1) so the
	// amounts stay aligned with the correct asset after router sorting.
	let a0 = amount0.coin.value.toLowerCase();
	let a1 = amount1.coin.value.toLowerCase();
	let amt0Raw = amount0.amount.toString();
	let amt1Raw = amount1.amount.toString();
	if (a0 > a1) {
		[a0, a1] = [a1, a0];
		[amt0Raw, amt1Raw] = [amt1Raw, amt0Raw];
	}

	const payloadStr = JSON.stringify({
		type: 'deposit',
		version: '1.0.0',
		asset0: a0,
		asset1: a1,
		amount0: amt0Raw,
		amount1: amt1Raw,
		recipient: caller
	});

	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: DEX_ROUTER_CONTRACT_ID,
		action: 'execute',
		payload: payloadStr,
		rc_limit: 5000,
		intents: buildIntents([
			{ coinValue: a0, rawAmount: amt0Raw },
			{ coinValue: a1, rawAmount: amt1Raw }
		])
	};

	return wrapVscCall(username, op);
}

/**
 * Build the VSC custom_json op for removing liquidity. Always targets
 * the DEX router with a `withdrawal` instruction; the router calls the
 * underlying pool's `remove_liquidity` and the pool sends both
 * underlying assets back to `recipient`. No intents needed because the
 * user isn't sending assets in.
 *
 * Reference payload (asset0/asset1 in alphabetical order):
 *   { type: "withdrawal", version: "1.0.0",
 *     asset0: "hbd", asset1: "hive",
 *     lp_amount: "2594",
 *     recipient: "hive:user" }
 */
export function getRemoveLiquidityOp(
	username: string,
	lpAmount: number,
	pairSymbols: [string, string]
): CustomJsonOperation {
	const caller = `hive:${username}`;

	let a0 = pairSymbols[0].toLowerCase();
	let a1 = pairSymbols[1].toLowerCase();
	if (a0 > a1) [a0, a1] = [a1, a0];

	const payloadStr = JSON.stringify({
		type: 'withdrawal',
		version: '1.0.0',
		asset0: a0,
		asset1: a1,
		lp_amount: String(lpAmount),
		recipient: caller
	});

	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: DEX_ROUTER_CONTRACT_ID,
		action: 'execute',
		payload: payloadStr,
		rc_limit: 5000,
		intents: [] as Array<{ type: string; args: Record<string, string> }>
	};

	return wrapVscCall(username, op);
}
