import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/send/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
/**
 *
 * @param from Ex. "vaultec"
 * @param toDid a DID; Ex. "hive:vaultec"
 * @param hiveAmount
 * @returns
 */
type withdrawOp = {
	from: string;
	to: string;
	amount: string;
	asset: string;
	net_id: string;
	memo?: string;
};
export function getHiveWithdrawalOp(
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	memo?: URLSearchParams
): CustomJsonOperation {
	const jsonOutput: withdrawOp = {
		from: `hive:${from}`,
		to: toDid,
		asset: amount.coin.unit.toLowerCase(),
		net_id: 'vsc-mainnet',
		amount: amount.toPrettyAmountString()
	};
	if (memo) {
		jsonOutput.memo = memo.toString();
	}

	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.withdraw',
			json: JSON.stringify(jsonOutput)
		}
	];
}
