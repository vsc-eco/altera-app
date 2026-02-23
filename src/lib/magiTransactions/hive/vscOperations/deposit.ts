import { vscGateway } from '$lib/constants';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import type { TransferOperation } from '@hiveio/dhive';
import { getHiveAssetName, getHbdAssetName } from '../../../../client';
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
	// Use unit from localStorage (e.g. TESTS/TBD for testnet), fallback to HIVE/HBD
	const chainUnit =
		amount.coin.value === Coin.hbd.value ? getHbdAssetName() : getHiveAssetName();
	return [
		'transfer',
		{
			from,
			to: vscGateway,
			amount: `${amount.toAmountString(true)} ${chainUnit}`,
			memo: (memo ? new URLSearchParams([...defaultMemo, ...memo]) : defaultMemo).toString()
		}
	];
}