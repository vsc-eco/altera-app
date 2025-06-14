import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/send/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { json } from '@sveltejs/kit';
/**
 *
 * @param from Ex. "vaultec"
 * @param to Ex. "hive:vaultec" or "did:pkh:eip155:1:0x553Cb1F25f4409360E081E5e015812d1FB238e23"
 * @param hiveAmount
 * @returns
 */
type transferOp = {
	from: string,
	to: string,
	amount: string,
	asset: string,
	net_id: string,
	memo?: string,
}
export function getHiveTransferOp(
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	memo?: URLSearchParams,
): CustomJsonOperation {
	const jsonOutput: transferOp = {
		from: `hive:${from}`,
		to: toDid,
		asset: amount.coin.unit.toLowerCase(),
		net_id: 'vsc-mainnet',
		amount: amount.toPrettyAmountString(),
	}
	if (memo) {
		jsonOutput.memo = memo.toString();
	}

	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.transfer',
			json: JSON.stringify(jsonOutput)
		}
	];
}
