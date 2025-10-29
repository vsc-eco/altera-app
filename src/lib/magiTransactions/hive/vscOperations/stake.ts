import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
/**
 *
 * @param from Ex. "vaultec"
 * @param to Hive username; Ex. "vaultec"
 * @param hiveAmount Must be HBD
 * @returns
 */
export function getHbdStakeOp(
	from: string,
	to: string,
	amount: CoinAmount<typeof Coin.hbd>
): CustomJsonOperation {
	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.stake_hbd',
			json: JSON.stringify({
				from: `hive:${from}`,
				to: `hive:${to}`,
				asset: amount.coin.unit.toLowerCase(),
				net_id: 'vsc-mainnet',
				amount: amount.toPrettyAmountString()
			})
		}
	];
}

/**
 *
 * @param from Ex. "vaultec"
 * @param to Ex. "vaultec"
 * @param hiveAmount Must be HBD
 * @returns
 */
export function getHbdUnstakeOp(
	from: string,
	to: string,
	amount: CoinAmount<typeof Coin.hbd>
): CustomJsonOperation {
	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.unstake_hbd',
			json: JSON.stringify({
				from: `hive:${from}`,
				to: `hive:${to}`,
				asset: amount.coin.unit.toLowerCase(),
				net_id: 'vsc-mainnet',
				amount: amount.toPrettyAmountString()
			})
		}
	];
}
