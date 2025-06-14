import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/send/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
/**
 *
 * @param username ex: "vaultec"
 * @param to NOT a DID; ex. "vaultec" or "0x553Cb1F25f4409360E081E5e015812d1FB238e23"
 * @param amount A coin amount
 * @returns
 */
type stakeOrUnstakeOp = {
	from: string;
	to: string;
	amount: string;
	asset: string;
	net_id: string;
};
export function getHiveConsensusStakeOp(
	username: string,
	nodeRunnerAccount: string,
	hiveAmount: CoinAmount<typeof Coin.hive>
): CustomJsonOperation {
	const jsonOutput: stakeOrUnstakeOp = {
		from: `hive:${username}`,
		to: `hive:${nodeRunnerAccount}`,
		asset: 'hive',
		net_id: 'vsc-mainnet',
		amount: hiveAmount.toPrettyAmountString()
	};

	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.consensus_stake',
			json: JSON.stringify(jsonOutput)
		}
	];
}

export function getHiveConsensusUnstakeOp(
	username: string,
	nodeRunnerAccount: string,
	hiveAmount: CoinAmount<typeof Coin.hive>
): CustomJsonOperation {
	const jsonOutput: stakeOrUnstakeOp = {
		from: `hive:${username}`,
		to: `hive:${nodeRunnerAccount}`,
		asset: 'hive',
		net_id: 'vsc-mainnet',
		amount: hiveAmount.toPrettyAmountString()
	};

	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.consensus_unstake',
			json: JSON.stringify(jsonOutput)
		}
	];
}
