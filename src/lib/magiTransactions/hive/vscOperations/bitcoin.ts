import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
import type { TransferInput, UnmapInput } from '$lib/magiTransactions/bitcoin/bitcoinContractCalls';

type callContractOp = {
	net_id: string;
	caller: string;
	contract_id: string;
	action: string;
	payload: object;
	rc_limit: number;
};

/**
 * @param from      Hive username, e.g. "vaultec"
 * @param toDid     Recipient DID, e.g. "hive:vaultec"
 * @param callerDid Caller DID (defaults to hive:${from} if omitted)
 */
export function getBitcoinTransferOp(
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.btc>,
	_memo?: URLSearchParams,
	callerDid?: string
): CustomJsonOperation {
	const payload: TransferInput = {
		amount: amount.amount.toString(),
		to: toDid
	};

	const jsonOutput: callContractOp = {
		net_id: vscNetworkId,
		caller: callerDid ?? `hive:${from}`,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'transfer',
		payload,
		rc_limit: 1000
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

/**
 * @param from         Hive username, e.g. "vaultec"
 * @param callerDid    Caller DID, e.g. "hive:vaultec"
 * @param toBtcAddress Raw Bitcoin mainnet address
 */
export function getBitcoinUnmapOp(
	from: string,
	callerDid: string,
	toBtcAddress: string,
	amount: CoinAmount<typeof Coin.btc>,
	deductFee?: boolean,
	maxFee?: number
): CustomJsonOperation {
	const payload: UnmapInput = {
		amount: amount.amount.toString(),
		to: toBtcAddress,
		...(deductFee ? { deduct_fee: true } : {}),
		...(maxFee != null ? { max_fee: maxFee } : {})
	};

	const jsonOutput: callContractOp = {
		net_id: vscNetworkId,
		caller: callerDid,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'unmap',
		payload,
		rc_limit: 10000
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
