import { vscGateway } from '$lib/constants';
import { CoinAmount } from '$lib/currency/CoinAmount';
import type { Coin } from '$lib/sendswap/utils/sendOptions';
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
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	memo?: URLSearchParams
): TransferOperation {
	const defaultMemo = new URLSearchParams(`to=${toDid.split(':').at(-1)}`);
	return [
		'transfer',
		{
			from,
			to: vscGateway,
			amount: `${amount.toAmountString(true)} ${amount.coin.unit}`,
			memo: (memo ? new URLSearchParams([...defaultMemo, ...memo]) : defaultMemo).toString()
		}
	];
}
