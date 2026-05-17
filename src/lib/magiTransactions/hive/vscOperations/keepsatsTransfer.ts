import { CoinAmount } from '$lib/currency/CoinAmount'
import { Coin } from '$lib/sendswap/utils/sendOptions'
import type { CustomJsonOperation } from '@hiveio/dhive'

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

export function getKeepsatsTransferOp(
	from: string,
	amount: CoinAmount<typeof Coin.sats>
): CustomJsonOperation {
	const jsonOutput: keepsatsTransferOp = {
		net_id: 'vsc-mainnet',
		caller: `hive:${from}`,
		contract_id: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d',
		action: 'transfer',
		payload: {
			amount: amount.toAmountString(),
			to: 'hive:v4vapp',
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
