import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { MAPPINGCONTRACTID } from '$lib/stores/currentBalance';
import type { TransferInput, UnmapInput } from '$lib/magiTransactions/bitcoin/bitcoinContractCalls';
import { getCallContractOp } from './contract';

/**
 *
 * @param from Ex. "vaultec"
 * @param to Ex. "hive:vaultec" or "did:pkh:eip155:1:0x553Cb1F25f4409360E081E5e015812d1FB238e23"
 * @param hiveAmount
 * @returns
 */

export function getBitcoinTransferOp(
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.btc>
): CustomJsonOperation {
	const payload: TransferInput = {
		// amt in sats (toNumber would be amt in bitcoin)
		amount: amount.amount,
		recipient_vsc_address: toDid
	};

	return getCallContractOp(from, MAPPINGCONTRACTID, 'transfer', payload);
}

export function getBitcoinUnmapOp(
	from: string,
	toBtcAddress: string,
	amount: CoinAmount<typeof Coin.btc>
): CustomJsonOperation {
	const payload: UnmapInput = {
		amount: amount.amount,
		recipient_btc_address: toBtcAddress
	};

	return getCallContractOp(from, MAPPINGCONTRACTID, 'unmap', payload);
}
