import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';

/** Contract id for swap (same as used in params / execute). */
export const SWAP_CONTRACT_ID = 'vsc1BoZJMQqpmdLxUfyRt5Tz82YM7Z57r7Dos7';

type SwapPayload = {
	type: 'swap';
	version: '1.0.0';
	asset_in: 'hive' | 'hbd';
	asset_out: 'hive' | 'hbd';
	amount_in: number;
	min_amount_out: number;
	recipient: string;
};

type ExecuteOp = {
	net_id: string;
	caller: string;
	contract_id: string;
	action: 'execute';
	payload: SwapPayload;
	rc_limit: number;
	intents: Array<{ type: string; args: Record<string, string> }>;
};

/**
 * Builds the VSC execute operation for swapping hive<->hbd on Magi.
 * caller = hive:username (Hive login user).
 * amount_in = amount in smallest units (e.g. 5 TBD = 5000 with 3 decimals).
 */
export function getHiveSwapOp(
	username: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	assetIn: typeof Coin.hive | typeof Coin.hbd,
	assetOut: typeof Coin.hive | typeof Coin.hbd,
	minAmountOut?: number
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const payload: SwapPayload = {
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn.value as 'hive' | 'hbd',
		asset_out: assetOut.value as 'hive' | 'hbd',
		amount_in: amount.amount,
		min_amount_out: minAmountOut ?? 0,
		recipient: caller
	};
	const executeOp: ExecuteOp = {
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
