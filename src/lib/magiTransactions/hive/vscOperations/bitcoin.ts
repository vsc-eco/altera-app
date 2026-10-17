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

/** The unmap payload, shared by the dry run and the broadcast op so the RC
 *  estimate is measured on exactly the call that gets signed. */
export function getBitcoinUnmapPayload(
	toBtcAddress: string,
	amount: CoinAmount<typeof Coin.btc>,
	deductFee?: boolean,
	maxFee?: number
): UnmapInput {
	return {
		amount: amount.amount.toString(),
		to: toBtcAddress,
		...(deductFee ? { deduct_fee: true } : {}),
		...(maxFee != null ? { max_fee: maxFee } : {})
	};
}

/**
 * @param from         Hive username, e.g. "vaultec"
 * @param callerDid    Caller DID, e.g. "hive:vaultec"
 * @param toBtcAddress Raw Bitcoin mainnet address
 * @param rcLimit      Size it with `estimateCallRc` (see rcSizing.ts). An
 *                     unmap's cost grows with the number of vault UTXOs it
 *                     chains, so no fixed value is safe: 10,000 failed every
 *                     mainnet unmap above ~30,000 sats in October 2026.
 */
export function getBitcoinUnmapOp(
	from: string,
	callerDid: string,
	toBtcAddress: string,
	amount: CoinAmount<typeof Coin.btc>,
	rcLimit: number,
	deductFee?: boolean,
	maxFee?: number
): CustomJsonOperation {
	const jsonOutput: callContractOp = {
		net_id: vscNetworkId,
		caller: callerDid,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'unmap',
		payload: getBitcoinUnmapPayload(toBtcAddress, amount, deductFee, maxFee),
		rc_limit: rcLimit
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
