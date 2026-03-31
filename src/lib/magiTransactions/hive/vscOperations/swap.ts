import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/pools/poolsData';

/**
 * DEX Router — handles all swap types (HIVE/HBD, BTC/HBD, BTC/HIVE multi-hop).
 * All swaps go through the router which auto-discovers the correct pool.
 */
export const SWAP_CONTRACT_ID = 'vsc1BoZJMQqpmdLxUfyRt5Tz82YM7Z57r7Dos7';

type SwapCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

/**
 * Approves the DEX router to spend BTC from the mapping contract.
 * Must be sent before any BTC swap — router needs allowance to pull BTC.
 */
export function getBtcApproveOp(username: string): CustomJsonOperation {
	const caller = `hive:${username}`;
	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'approve',
		payload: JSON.stringify({
			spender: `contract:${SWAP_CONTRACT_ID}`,
			amount: '999999999'
		}),
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

export function getHiveSwapOp(
	username: string,
	amount: CoinAmount<SwapCoin>,
	assetIn: SwapCoin,
	assetOut: SwapCoin,
	minAmountOut?: number
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const isNative = assetIn.value === Coin.hive.value || assetIn.value === Coin.hbd.value;

	const payloadStr = JSON.stringify({
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn.value.toUpperCase(),
		asset_out: assetOut.value.toUpperCase(),
		amount_in: String(amount.amount),
		min_amount_out: minAmountOut ? String(minAmountOut) : '0',
		recipient: caller
	});

	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: SWAP_CONTRACT_ID,
		action: 'execute',
		payload: payloadStr,
		rc_limit: 5000,
		intents: isNative
			? [{ type: 'transfer.allow', args: { limit: amount.toAmountString(true), token: assetIn.value } }]
			: ([] as Array<{ type: string; args: Record<string, string> }>)
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
