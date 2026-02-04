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
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { getHiveDepositOp } from './vscOperations/deposit';
import { getHiveTransferOp } from './vscOperations/transfer';
import { getHiveWithdrawalOp } from './vscOperations/withdrawal';
import { type OperationResult } from '@aioha/aioha/build/types';
import { getHbdStakeOp, getHbdUnstakeOp } from './vscOperations/stake';
import { getBitcoinTransferOp, getBitcoinUnmapOp } from './vscOperations/bitcoin';
import {
	getAddLiquidityOp,
	getRemoveLiquidityOp
} from './vscOperations/liquidityPool';

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
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.magi.value) {
		return 'transfer';
	}
	if (fromNetwork.value == Network.hiveMainnet.value && toNetwork.value == Network.magi.value) {
		return 'deposit';
	}
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.hiveMainnet.value) {
		return 'withdrawal';
	}
}

export const getSendOpGenerator = (
	fromNetwork: Network,
	toNetwork: Network,
	toCoin: Coin
): ((
	from: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>,
	memo?: URLSearchParams
) => Operation) => {
	if (toCoin.value === Coin.btc.value) {
		if (toNetwork.value === Network.magi.value) {
			return getBitcoinTransferOp;
		} else if (toNetwork.value === Network.btcMainnet.value) {
			return getBitcoinUnmapOp;
		} else {
			throw new Error(
				`VSC does not currently support sending bitcoin from ${fromNetwork.label} to ${toNetwork.label}`
			);
		}
	}
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.magi.value) {
		return getHiveTransferOp;
	}
	if (fromNetwork.value == Network.hiveMainnet.value && toNetwork.value == Network.magi.value) {
		return getHiveDepositOp;
	}
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.hiveMainnet.value) {
		return getHiveWithdrawalOp;
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
};

// Export liquidity pool operations
export {
	getAddLiquidityOp,
	getRemoveLiquidityOp,
	getRegisterPoolOp,
	createLiquidityPoolInstruction
} from './vscOperations/liquidityPool';

// Export generic contract call operations
export {
	getGenericContractCallOp,
	getGenericContractCallOpWithRcLimit,
	getGenericContractCallOpWithIntents
} from './vscOperations/genericContractCall';

// Export swap operations
export {
	getSwapCallContractOp,
	createDexSwapInstruction,
	getDexSwapCallOp
} from './vscOperations/swap';

// Export V2 DEX type definitions
export type { 
	LiquidityPoolInstruction, 
	LiquidityPoolExecutePayload,
	AddLiquidityPayload,
	RemoveLiquidityPayload,
	RegisterPoolPayload
} from './vscOperations/vsc-op-types';
export type { 
	GenericContractCallParams, 
	DexInstruction, 
	DexExecutePayload,
	DexReturnAddress
} from './vscOperations/vsc-op-types';

/**
 * Enhanced getSendOpGenerator that supports liquidity pool operations.
 * When operationType is 'addLiquidity' or 'removeLiquidity', additional params are required.
 * 
 * @param fromNetwork Source network
 * @param toNetwork Target network
 * @param toCoin Target coin (can be undefined for LP operations)
 * @param operationType Optional operation type ('addLiquidity', 'removeLiquidity', or standard transfer types)
 * @param operationParams Optional additional parameters for LP operations
 * @returns Operation builder function or null if operation type cannot be determined
 */
export function getSendOpGeneratorEnhanced(
	fromNetwork: Network,
	toNetwork: Network,
	toCoin: Coin | undefined,
	operationType?: string,
	operationParams?: Record<string, unknown>
): ((
	from: string,
	toDid: string,
	amount: CoinAmount<any>,
	memo?: URLSearchParams
) => Operation) | null {
	// Handle liquidity pool operations
	if (operationType === 'addLiquidity' && operationParams) {
		return (from: string) => {
			const { dexContractId, amount0In, amount1In, minLiquidityOut, recipient, deadline } =
				operationParams as any;
			return getAddLiquidityOp(
				from,
				dexContractId,
				amount0In,
				amount1In,
				minLiquidityOut,
				recipient,
				deadline
			);
		};
	}

	if (operationType === 'removeLiquidity' && operationParams) {
		return (from: string) => {
			const { dexContractId, lpTokenAmount, minAmount0Out, minAmount1Out, recipient, deadline } =
				operationParams as any;
			return getRemoveLiquidityOp(
				from,
				dexContractId,
				lpTokenAmount,
				minAmount0Out,
				minAmount1Out,
				recipient,
				deadline
			);
		};
	}

	// Fall back to standard getSendOpGenerator for regular transfers
	if (toCoin) {
		return getSendOpGenerator(fromNetwork, toNetwork, toCoin);
	}

	return null;
}

