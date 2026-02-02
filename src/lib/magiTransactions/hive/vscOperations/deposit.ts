import { vscGateway } from '$lib/constants';
import { CoinAmount } from '$lib/currency/CoinAmount';
import type { Coin, HiveCoin } from '$lib/sendswap/utils/sendOptions';
import { Aioha } from '@aioha/aioha';
import type { CustomJsonOperation, TransferOperation } from '@hiveio/dhive';
/**
 *
 * @param from ex: "vaultec"
 * @param toDid a DID; ex. "hive:vaultec" or "did:pkh:eip155:1:0x553Cb1F25f4409360E081E5e015812d1FB238e23"
 * @param amount A coin amount
 * @returns
 */
export function getHiveDepositOp(
	from: string,
	toDid: string,
	amount: CoinAmount<HiveCoin>,
	memo?: URLSearchParams
): TransferOperation {
	const defaultMemo = new URLSearchParams(`to=${toDid.split(':').at(-1)}`);
	return {
		type: "transfer_operation",
		value: {
			from,
			to: vscGateway,
			amount: {
				amount: amount.amount.toString(),
				nai: amount.coin.nai,
				precision: amount.coin.decimalPlaces
			},
			memo: (memo ? new URLSearchParams([...defaultMemo, ...memo]) : defaultMemo).toString()
		}
	};
}