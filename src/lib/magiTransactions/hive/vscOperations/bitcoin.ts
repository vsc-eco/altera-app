import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { json } from '@sveltejs/kit';
import { MAPPINGCONTRACTID } from '$lib/stores/currentBalance';
import type { TransferInput, UnmapInput } from '$lib/magiTransactions/bitcoin/bitcoinContractCalls';
/**
 *
 * @param from Ex. "vaultec"
 * @param to Ex. "hive:vaultec" or "did:pkh:eip155:1:0x553Cb1F25f4409360E081E5e015812d1FB238e23"
 * @param hiveAmount
 * @returns
 */
type callContractOp = {
	action: string;
	contract_id: string;
	intents: [];
	payload: string;
	rc_limit: number;
	type: 'call';
};

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

	const jsonOutput: callContractOp = {
		action: 'transfer',
		contract_id: MAPPINGCONTRACTID,
		payload: JSON.stringify(payload),
		rc_limit: 10000,
		intents: [],
		type: 'call'
	};

	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(jsonOutput)
		}
	];
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

	const jsonOutput: callContractOp = {
		action: 'unmap',
		contract_id: MAPPINGCONTRACTID,
		payload: JSON.stringify(payload),
		rc_limit: 10000,
		intents: [],
		type: 'call'
	};

	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(jsonOutput)
		}
	];
}
