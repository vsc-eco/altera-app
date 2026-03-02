import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { HIVE_HBD_POOL_CONTRACT_ID } from '$lib/pools/poolsData';

type AddLiquidityPayload = {
	type: 'add_liquidity';
	amount0: number;
	amount1: number;
	recipient: string;
};

type RemoveLiquidityPayload = {
	type: 'remove_liquidity';
	lp_amount: number;
	recipient: string;
};

type ExecuteOp = {
	net_id: string;
	caller: string;
	contract_id: string;
	action: 'execute';
	payload: AddLiquidityPayload | RemoveLiquidityPayload;
	rc_limit: number;
	intents: Array<{ type: string; args: Record<string, string> }>;
};

/**
 * Build the VSC execute op for adding liquidity to the HIVE/HBD pool.
 * - amount0 / amount1 are integers in the assets' smallest units.
 * - recipient receives the LP tokens.
 */
export function getAddLiquidityOp(
	username: string,
	amount0: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	amount1: CoinAmount<typeof Coin.hive | typeof Coin.hbd>
): CustomJsonOperation {
	const caller = `hive:${username}`;

	const payload: AddLiquidityPayload = {
		type: 'add_liquidity',
		amount0: amount0.amount,
		amount1: amount1.amount,
		recipient: caller
	};

	const op: ExecuteOp = {
		net_id: vscNetworkId,
		caller,
		contract_id: HIVE_HBD_POOL_CONTRACT_ID,
		action: 'execute',
		payload,
		rc_limit: 5000,
		intents: [
			{
				type: 'transfer.allow',
				args: {
					limit: amount0.toAmountString(true),
					token: amount0.coin.value
				}
			},
			{
				type: 'transfer.allow',
				args: {
					limit: amount1.toAmountString(true),
					token: amount1.coin.value
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
			json: JSON.stringify(op)
		}
	];
}

/**
 * Build the VSC execute op for removing liquidity from the HIVE/HBD pool.
 * - lp_amount is an integer amount of LP tokens to burn.
 * - recipient receives withdrawn assets.
 */
export function getRemoveLiquidityOp(username: string, lpAmount: number): CustomJsonOperation {
	const caller = `hive:${username}`;

	const payload: RemoveLiquidityPayload = {
		type: 'remove_liquidity',
		lp_amount: lpAmount,
		recipient: caller
	};

	const op: ExecuteOp = {
		net_id: vscNetworkId,
		caller,
		contract_id: HIVE_HBD_POOL_CONTRACT_ID,
		action: 'execute',
		payload,
		rc_limit: 5000,
		intents: []
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

