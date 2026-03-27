import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { HIVE_HBD_POOL_CONTRACT_ID } from '$lib/pools/poolsData';

// Contract for the BTC/HBD pool router (handles deposit/withdraw with asset routing)
const BTC_HBD_ROUTER_CONTRACT = 'vsc1BoZJMQqpmdLxUfyRt5Tz82YM7Z57r7Dos7';

type LiquidityCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

/**
 * Determine which contract and payload format to use based on the asset pair.
 * - BTC/HBD pair uses the router contract with deposit-style payload
 * - HIVE/HBD pair uses the pool contract directly with add_liquidity payload
 */
function isBtcPair(
	coin0: LiquidityCoin,
	coin1: LiquidityCoin
): boolean {
	const values = [coin0.value, coin1.value];
	return values.includes(Coin.btc.value);
}

/**
 * Build the VSC execute op for adding liquidity.
 *
 * For BTC/HBD pools (matches reference tx format):
 *   payload: { type: "deposit", version: "1.0.0", asset_in: "BTC", asset_out: "HBD",
 *              recipient: "hive:user", metadata: { amount0: "50000", amount1: "50000" } }
 *   intents: [{ type: "transfer.allow", args: { limit: "50000", token: "hbd" } }]
 *
 * For HIVE/HBD pools:
 *   payload: { type: "add_liquidity", amount0, amount1, recipient }
 *   intents: [{ type: "transfer.allow", args: { limit, token } }, ...]
 */
export function getAddLiquidityOp(
	username: string,
	amount0: CoinAmount<LiquidityCoin>,
	amount1: CoinAmount<LiquidityCoin>
): CustomJsonOperation {
	const caller = `hive:${username}`;

	if (isBtcPair(amount0.coin, amount1.coin)) {
		// BTC/HBD pool — use router contract with deposit payload
		// Both amount0 and amount1 use the HBD value (same raw amount)
		const isBtc0 = amount0.coin.value === Coin.btc.value;
		const hbdAmt = isBtc0 ? amount1 : amount0;
		const hbdRaw = hbdAmt.amount.toString();

		// payload must be a JSON STRING (double-encoded), not an object
		const payloadStr = JSON.stringify({
			type: 'deposit',
			version: '1.0.0',
			asset_in: 'BTC',
			asset_out: 'HBD',
			recipient: caller,
			metadata: {
				amount0: hbdRaw,
				amount1: hbdRaw
			}
		});

		const op = {
			net_id: vscNetworkId,
			caller,
			contract_id: BTC_HBD_ROUTER_CONTRACT,
			action: 'execute',
			payload: payloadStr,
			rc_limit: 1000,
			intents: [
				{
					type: 'transfer.allow',
					args: {
						limit: hbdRaw,
						token: 'hbd'
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

	// HIVE/HBD pool — use pool contract directly
	const payload = {
		type: 'add_liquidity',
		amount0: amount0.amount,
		amount1: amount1.amount,
		recipient: caller
	};

	const op = {
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
					limit: amount0.amount.toString(),
					token: amount0.coin.value
				}
			},
			{
				type: 'transfer.allow',
				args: {
					limit: amount1.amount.toString(),
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
 * Build the VSC execute op for removing liquidity.
 *
 * For BTC/HBD pools (matches reference tx format):
 *   payload: { type: "withdrawal", version: "1.0.0", asset_in: "BTC", asset_out: "HBD",
 *              recipient: "hive:user", metadata: { lp_amount: "2594" } }
 *   intents: []
 *
 * For HIVE/HBD pools:
 *   payload: { type: "remove_liquidity", lp_amount, recipient }
 *   intents: []
 */
export function getRemoveLiquidityOp(
	username: string,
	lpAmount: number,
	pairSymbols: [string, string]
): CustomJsonOperation {
	const caller = `hive:${username}`;

	if (pairSymbols.some((s) => s.toUpperCase() === 'BTC')) {
		// BTC/HBD pool — use router contract with withdrawal payload (double-encoded)
		const payloadStr = JSON.stringify({
			type: 'withdrawal',
			version: '1.0.0',
			asset_in: 'BTC',
			asset_out: 'HBD',
			recipient: caller,
			metadata: { lp_amount: String(lpAmount) }
		});

		const op = {
			net_id: vscNetworkId,
			caller,
			contract_id: BTC_HBD_ROUTER_CONTRACT,
			action: 'execute',
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

	// HIVE/HBD pool — use pool contract directly
	const payload = {
		type: 'remove_liquidity',
		lp_amount: lpAmount,
		recipient: caller
	};

	const op = {
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

