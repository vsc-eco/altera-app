import { CoinAmount } from '$lib/currency/CoinAmount';
import type { Coin } from '$lib/send/sendOptions';
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
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>
): TransferOperation {
	return [
		'transfer',
		{
			from,
			to: 'vsc.gateway',
			amount: amount.toPrettyString(),
			memo: `to=${toDid.split(':').at(-1)}`
		}
	];
}
