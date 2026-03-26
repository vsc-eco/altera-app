import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { HBD_BTC_POOL_CONTRACT_ID } from '$lib/pools/poolsData';

/** Contract id for HIVE/HBD DEX swap. */
export const SWAP_CONTRACT_ID = 'vsc1Brm1QpGF8WXvRCvwgbpB6fiHtTBJzyZUC9';

type SwapCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

function isBtcSwap(assetIn: SwapCoin, assetOut: SwapCoin): boolean {
	return assetIn.value === Coin.btc.value || assetOut.value === Coin.btc.value;
}

/**
 * Builds the VSC operation for swapping on Magi DEX.
 *
 * BTC/HBD swaps use the BTC/HBD pool contract with format:
 *   action: "swap"
 *   payload: JSON string with { asset_in, amount_in, asset_out, min_amount_out, to, from }
 *   intents: []
 *
 * HIVE/HBD swaps use the HIVE/HBD pool contract with the legacy format.
 */
export function getHiveSwapOp(
	username: string,
	amount: CoinAmount<SwapCoin>,
	assetIn: SwapCoin,
	assetOut: SwapCoin,
	minAmountOut?: number
): CustomJsonOperation {
	const caller = `hive:${username}`;

	if (isBtcSwap(assetIn, assetOut)) {
		// BTC/HBD swap — payload is a JSON string, action is "swap", no intents
		// min_amount_out is always "0" for BTC/HBD swaps (pool handles slippage internally)
		const payloadStr = JSON.stringify({
			asset_in: assetIn.value,
			amount_in: amount.amount.toString(),
			asset_out: assetOut.value,
			min_amount_out: '0',
			to: caller,
			from: caller
		});

		const op = {
			net_id: vscNetworkId,
			caller,
			contract_id: HBD_BTC_POOL_CONTRACT_ID,
			action: 'swap',
			payload: payloadStr,
			rc_limit: 1000,
			intents: [] as Array<{ type: string; args: Record<string, string> }>
		};

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

	// HIVE/HBD swap — legacy format
	const payload = {
		type: 'swap' as const,
		version: '1.0.0' as const,
		asset_in: assetIn.value as 'hive' | 'hbd',
		asset_out: assetOut.value as 'hive' | 'hbd',
		amount_in: amount.amount,
		min_amount_out: minAmountOut ?? 0,
		recipient: caller
	};

	const executeOp = {
		net_id: vscNetworkId,
		caller,
		contract_id: SWAP_CONTRACT_ID,
		action: 'execute',
		payload,
		rc_limit: 5000,
		intents: [
			{
				type: 'transfer.allow',
				args: {
					limit: amount.toAmountString(true),
					token: assetIn.value
				}
			}
		]
	};

	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(executeOp)
		}
	];
}
