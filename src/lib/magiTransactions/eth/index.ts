import type {
	TransferTransaction,
	DepositTransaction,
	WithdrawTransaction,
	CallContractTransaction
} from '../eth/client';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import { MAPPINGCONTRACTID } from '$lib/stores/currentBalance';
import type { TransferInput, UnmapInput } from '../bitcoin/bitcoinContractCalls';

export function getEVMOpType(
	fromNetwork: Network,
	toNetwork: Network,
	fromDid: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>,
	operationType?: string,
	operationParams?: Record<string, unknown>
): TransferTransaction | DepositTransaction | WithdrawTransaction | CallContractTransaction {

		// If caller explicitly requests a dex/router execute operation, handle it here
		if (operationType === 'dex-swap' && operationParams) {
			return getEVMDexSwapOp(fromDid, operationParams);
		}
	if (amount.coin.value === Coin.btc.value) {
		if (toNetwork.value === Network.magi.value) {
			const payload: TransferInput = {
				amount: amount.amount,
				recipient_vsc_address: toDid
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: MAPPINGCONTRACTID,
					action: 'transfer',
					payload: JSON.stringify(payload),
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		} else if (toNetwork.value === Network.btcMainnet.value) {
			const payload: UnmapInput = {
				amount: amount.amount,
				recipient_btc_address: toDid
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: MAPPINGCONTRACTID,
					action: 'unmap',
					payload: JSON.stringify(payload),
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		}
	}
	let payload = {
		from: fromDid,
		to: toDid,
		amount: amount.toPrettyAmountString(),
		asset: amount.coin.unit.toLowerCase()
	};
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.magi.value) {
		return {
			op: 'transfer',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.hiveMainnet.value && toNetwork.value == Network.magi.value) {
		return {
			op: 'deposit',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.magi.value && toNetwork.value == Network.hiveMainnet.value) {
		return {
			op: 'withdraw',
			payload: payload
		};
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
}

/**
 * Build a dex swap (router execute) CallContractTransaction for EVM wallets.
 * operationParams expected to contain:
 *  - routerV2ContractId: string
 *  - instruction: object (DexInstruction)
 *  - amountIn: number
 */
export function getEVMDexSwapOp(
	fromDid: string,
	operationParams: Record<string, unknown>
): CallContractTransaction {
	const { routerV2ContractId, instruction, amountIn, rcLimit } = operationParams as any;
	if (!routerV2ContractId || !instruction || amountIn === undefined) {
		throw new Error('Missing parameters for dex swap operation');
	}

	const payload = {
		instruction,
		amount_in: amountIn
	};

	return getEVMContractOpType(fromDid, routerV2ContractId as string, 'execute', payload, rcLimit ?? 10000);
}

/**
 * Enhanced getEVMOpType that supports liquidity pool and generic contract operations.
 * Builds CallContractTransaction for EVM wallets to post directly to VSC Magi.
 * 
 * @param fromDid Caller DID on VSC
 * @param contractId VSC contract ID to call
 * @param action Contract action/method name
 * @param payload Operation payload as object (will be stringified)
 * @param rcLimit Optional RC limit (default: 10000)
 * @returns CallContractTransaction for EVM wallet signing
 */
export function getEVMContractOpType(
	fromDid: string,
	contractId: string,
	action: string,
	payload: Record<string, unknown>,
	rcLimit: number = 10000
): CallContractTransaction {
	return {
		op: 'call',
		payload: {
			contract_id: contractId,
			action: action,
			payload: JSON.stringify(payload),
			rc_limit: rcLimit,
			intents: [],
			caller: fromDid
		}
	};
}

/**
 * Build a liquidity pool operation for EVM wallets.
 * 
 * @param fromDid Caller DID
 * @param operationType 'addLiquidity' or 'removeLiquidity'
 * @param operationParams Operation-specific parameters
 * @returns CallContractTransaction
 */
export function getEVMLiquidityPoolOp(
	fromDid: string,
	operationType: 'addLiquidity' | 'removeLiquidity',
	operationParams: Record<string, unknown>
): CallContractTransaction {
	const { dexContractId, ...lpParams } = operationParams;
	const action = operationType === 'addLiquidity' ? 'add_liquidity' : 'remove_liquidity';
	
	return getEVMContractOpType(fromDid, dexContractId as string, action, lpParams);
}

