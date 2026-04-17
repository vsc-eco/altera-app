import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId, DEX_ROUTER_CONTRACT_ID } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';

/**
 * DEX Router — handles all swap types (HIVE/HBD, BTC/HBD, BTC/HIVE multi-hop).
 * All swaps go through the router which auto-discovers the correct pool.
 * Re-exported here for backwards compatibility with existing imports.
 */
export const SWAP_CONTRACT_ID = DEX_ROUTER_CONTRACT_ID;

type SwapCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

/**
 * Grants the DEX router allowance to spend exactly `amount` BTC (in SATS)
 * on the mapping contract. Uses `increaseAllowance` so the allowance is
 * additive per operation and matches the liquidity/swap amount being
 * consumed, rather than approving an arbitrarily large number.
 *
 * `CoinAmount.amount` for BTC is already in SATS (decimalPlaces = 8), so
 * it's passed through as the base-unit value the contract expects.
 */
export function getBtcApproveOp(
	username: string,
	amount: CoinAmount<typeof Coin.btc>
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'increaseAllowance',
		payload: JSON.stringify({
			spender: `contract:${SWAP_CONTRACT_ID}`,
			amount: String(amount.amount)
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
	minAmountOut?: number,
	destinationChain?: string,
	destinationRecipient?: string
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const isNative = assetIn.value === Coin.hive.value || assetIn.value === Coin.hbd.value;

	const payload: Record<string, string> = {
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn.value.toUpperCase(),
		asset_out: assetOut.value.toUpperCase(),
		amount_in: String(amount.amount),
		min_amount_out: minAmountOut ? String(minAmountOut) : '0',
		recipient: destinationRecipient ?? caller
	};
	if (destinationChain) {
		payload.destination_chain = destinationChain;
	}
	const payloadStr = JSON.stringify(payload);

	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: SWAP_CONTRACT_ID,
		action: 'execute',
		payload: payloadStr,
		rc_limit: 5000,
		intents: isNative
			? [
					{
						type: 'transfer.allow',
						args: { limit: amount.toAmountString(true), token: assetIn.value }
					}
				]
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
