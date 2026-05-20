import { CoinAmount } from '$lib/currency/CoinAmount'
import { Coin } from '$lib/sendswap/utils/sendOptions'
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants'
import type { CustomJsonOperation } from '@hiveio/dhive'
import { isVscTestnet, vscNetworkId } from '../../../../client'

/**
 * Create a custom_json operation to transfer MagiSats to V4VApp
 * @param from Ex. "v4vapp-test" (just the username)
 * @param amount CoinAmount of MagiSats
 * @returns CustomJsonOperation
 */
type keepsatsTransferOp = {
	net_id: string;
	caller: string;
	contract_id: string;
	action: string;
	payload: {
		amount: string;
		to: string;
		memo: string;
	};
	rc_limit: number;
};

export const getKeepsatsDestinationDid = (): string =>
	`hive:${isVscTestnet() ? 'v4vapp-test' : 'v4vapp'}`

export function getKeepsatsTransferOp(
	from: string,
	amount: CoinAmount<typeof Coin.sats>
): CustomJsonOperation {
	const jsonOutput: keepsatsTransferOp = {
		net_id: vscNetworkId,
		caller: `hive:${from}`,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'transfer',
		payload: {
			amount: amount.toAmountString(),
			to: getKeepsatsDestinationDid(),
			memo: 'Deposit #sats'
		},
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
