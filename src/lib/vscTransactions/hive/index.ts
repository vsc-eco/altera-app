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
import { getHiveWithdrawalOp } from './vscOperations/withdrawal';
import { type OperationResult } from '@aioha/aioha/build/types';
import { getHbdStakeOp, getHbdUnstakeOp } from './vscOperations/stake';

export const consensusTx = async (
	amount: string,
	nodeRunnerAccount: string,
	username: string,
	shouldDeposit: boolean,
	aioha: Aioha
): Promise<OperationResult> => {
	if (Number(amount) == 0)
		return {
			success: false,
			error: 'Error: cannot stake 0 HIVE.',
			errorCode: 0
		};
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
	return res;
};

export const consensusUnstakeTx = async (
	amount: string,
	nodeRunnerAccount: string,
	username: string,
	aioha: Aioha
): Promise<OperationResult> => {
	if (Number(amount) == 0)
		return {
			success: false,
			error: 'Error: cannot unstake 0 HIVE.',
			errorCode: 0
		};
	let unstakeOp = getHiveConsensusUnstakeOp(
		username,
		nodeRunnerAccount,
		new CoinAmount(amount, Coin.hive)
	);
	let ops: Operation[] = [];
	ops.push(unstakeOp);
	let res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	return res;
};

export const hbdStakeTx = async (
	amount: string,
	recipient: string,
	username: string,
	shouldDeposit: boolean,
	aioha: Aioha
): Promise<OperationResult> => {
	if (Number(amount) == 0)
		return {
			success: false,
			error: 'Error: cannot stake 0 HBD.',
			errorCode: 0
		};
	let stakeOp = getHbdStakeOp(username, recipient, new CoinAmount(amount, Coin.hbd));
	let depositOp = getHiveDepositOp(username, username, new CoinAmount(amount, Coin.hbd));
	let ops: Operation[] = [];
	if (shouldDeposit) ops.push(depositOp);
	ops.push(stakeOp);
	let res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	return res;
};

export const hbdUnstakeTx = async (
	amount: string,
	recipient: string,
	username: string,
	shouldDeposit: boolean,
	aioha: Aioha
): Promise<OperationResult> => {
	if (Number(amount) == 0)
		return {
			success: false,
			error: 'Error: cannot stake 0 HBD.',
			errorCode: 0
		};
	let stakeOp = getHbdUnstakeOp(username, recipient, new CoinAmount(amount, Coin.hbd));
	let depositOp = getHiveDepositOp(username, username, new CoinAmount(amount, Coin.hbd));
	let ops: Operation[] = [];
	if (shouldDeposit) ops.push(depositOp);
	ops.push(stakeOp);
	let res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	return res;
};

export const executeTx = async (aioha: Aioha, ops: Operation[]) => {
	const res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
	return res;
};

export function getSendOpType(fromNetwork: Network, toNetwork: Network) {
	if (fromNetwork == Network.vsc && toNetwork == Network.vsc) {
		return 'transfer';
	}
	if (fromNetwork == Network.hiveMainnet && toNetwork == Network.vsc) {
		return 'deposit';
	}
	if (fromNetwork == Network.vsc && toNetwork == Network.hiveMainnet) {
		return 'withdrawal';
	}
}

export const getSendOpGenerator = (
	fromNetwork: Network,
	toNetwork: Network
): ((
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	memo?: URLSearchParams
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
