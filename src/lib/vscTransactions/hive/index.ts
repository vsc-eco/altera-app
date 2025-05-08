import { Aioha } from '@aioha/aioha';
import { KeyTypes } from '@aioha/aioha';
import {
	Asset,
	type Operation,
	type TransferOperation,
	type CustomJsonOperation
} from '@hiveio/dhive';
import { getHiveConsensusStakeOp, getHiveConsensusUnstakeOp } from './vscOperations/consensus';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/send/sendOptions';
import { getHiveDepositOp } from './vscOperations/deposit';
import { getHiveTransferOp } from './vscOperations/transfer';
import { getDepositTransaction } from '../oldVscClient/client';
import { getHiveWithdrawalOp } from './vscOperations/withdrawal';

export const consensusTx = async (
	amount: string,
	nodeRunnerAccount: string,
	username: string,
	shouldDeposit: boolean,
	aioha: Aioha
) => {
	if (Number(amount) == 0) return 'Error: cannot stake 0 HIVE.';
	let stakeOp = getHiveConsensusStakeOp(
		username,
		nodeRunnerAccount,
		new CoinAmount(amount, Coin.hive)
	);
	let depositOp = getHiveDepositOp(username, username, new CoinAmount(amount, Coin.hive));
	let ops: Operation[] = [];
	if (shouldDeposit) ops.push(depositOp);
	ops.push(stakeOp);
	let res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	if (res.success) {
		return;
	} else {
		return res.error;
	}
};

export const consensusUnstakeTx = async (
	amount: string,
	nodeRunnerAccount: string,
	username: string,
	aioha: Aioha
) => {
	if (Number(amount) == 0) return 'Error: cannot stake 0 HIVE.';
	let unstakeOp = getHiveConsensusUnstakeOp(
		username,
		nodeRunnerAccount,
		new CoinAmount(amount, Coin.hive)
	);
	let ops: Operation[] = [];
	ops.push(unstakeOp);
	let res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	if (res.success) {
		return;
	} else {
		return res.error;
	}
};

export const executeTx = async (aioha: Aioha, ops: Operation[]) => {
	const res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	if (res.success) {
		return;
	} else {
		return res.error;
	}
};

export const getSendOpGenerator = (
	fromNetwork: Network,
	toNetwork: Network
): ((
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>
) => Operation) => {
	if (fromNetwork == Network.vsc && toNetwork == Network.vsc) {
		return getHiveTransferOp;
	}
	if (fromNetwork == Network.hiveMainnet && toNetwork == Network.vsc) {
		return getHiveDepositOp;
	}
	if (fromNetwork == Network.vsc && toNetwork == Network.hiveMainnet) {
		return getHiveWithdrawalOp;
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
};
