import type { CustomJsonOperation } from '@hiveio/dhive';
import { getCallContractOp } from './contract';
import type {
	AddLiquidityPayload,
	RemoveLiquidityPayload,
	LiquidityPoolInstruction,
	RegisterPoolPayload
} from './vsc-op-types';

/**
 * Generic wrapper for DEX liquidity pool operations on VSC.
 * Routes calls to individual DEX contracts (contracts/dex/).
 * Based on V2 architecture: https://github.com/vsc-eco/dex-contracts/blob/main/docs/architecture-v2.md
 */
export function getDexLiquidityPoolCallOp(
	from: string,
	dexContractId: string,
	action: string,
	payload: Record<string, unknown>
): CustomJsonOperation {
	return getCallContractOp(from, dexContractId, action, payload);
}

/**
 * Creates an "add_liquidity" operation for a DEX contract.
 * Calls the `add_liquidity` action on a specific DEX pool contract.
 *
 * @param from The account executing the operation
 * @param dexContractId The DEX contract ID for the specific pool
 * @param amount0In Amount of first token (in smallest unit)
 * @param amount1In Amount of second token (in smallest unit)
 * @param minLiquidityOut Minimum LP tokens to receive
 * @param recipient Address to receive LP tokens
 * @param deadline Optional transaction deadline (unix timestamp)
 * @returns A custom_json operation for adding liquidity
 */
export function getAddLiquidityOp(
	from: string,
	dexContractId: string,
	amount0In: number,
	amount1In: number,
	minLiquidityOut: number,
	recipient: string,
	deadline?: number
): CustomJsonOperation {
	const payload: AddLiquidityPayload = {
		amount0_in: amount0In,
		amount1_in: amount1In,
		min_liquidity_out: minLiquidityOut,
		recipient
	};

	if (deadline) {
		payload.deadline = deadline;
	}

	return getDexLiquidityPoolCallOp(from, dexContractId, 'add_liquidity', payload);
}

/**
 * Creates a "remove_liquidity" operation for a DEX contract.
 * Calls the `remove_liquidity` action on a specific DEX pool contract.
 *
 * @param from The account executing the operation
 * @param dexContractId The DEX contract ID for the specific pool
 * @param lpTokenAmount Amount of LP tokens to burn
 * @param minAmount0Out Minimum amount of first token to receive
 * @param minAmount1Out Minimum amount of second token to receive
 * @param recipient Address to receive tokens
 * @param deadline Optional transaction deadline (unix timestamp)
 * @returns A custom_json operation for removing liquidity
 */
export function getRemoveLiquidityOp(
	from: string,
	dexContractId: string,
	lpTokenAmount: number,
	minAmount0Out: number,
	minAmount1Out: number,
	recipient: string,
	deadline?: number
): CustomJsonOperation {
	const payload: RemoveLiquidityPayload = {
		lp_token_amount: lpTokenAmount,
		min_amount0_out: minAmount0Out,
		min_amount1_out: minAmount1Out,
		recipient
	};

	if (deadline) {
		payload.deadline = deadline;
	}

	return getDexLiquidityPoolCallOp(from, dexContractId, 'remove_liquidity', payload);
}

/**
 * Creates a pool registration operation for router-v2.
 * Registers a DEX contract for an asset pair with optional chain information.
 *
 * @param from The account executing the registration
 * @param routerV2ContractId The router-v2 contract ID
 * @param asset0 First asset identifier (e.g., "BTC", "HBD")
 * @param asset1 Second asset identifier (e.g., "HBD", "HIVE")
 * @param dexContractId The DEX pool contract ID to register
 * @param asset0Chain Optional chain for asset0 (e.g., "BTC")
 * @param asset1Chain Optional chain for asset1 (e.g., "HIVE")
 * @returns A custom_json operation for pool registration
 */
export function getRegisterPoolOp(
	from: string,
	routerV2ContractId: string,
	asset0: string,
	asset1: string,
	dexContractId: string,
	asset0Chain?: string,
	asset1Chain?: string
): CustomJsonOperation {
	const payload: RegisterPoolPayload = {
		asset0,
		asset1,
		dex_contract_id: dexContractId
	};

	if (asset0Chain) {
		payload.asset0_chain = asset0Chain;
	}

	if (asset1Chain) {
		payload.asset1_chain = asset1Chain;
	}

	return getCallContractOp(from, routerV2ContractId, 'register_pool', payload);
}

/**
 * Creates a liquidity pool instruction for router-v2 execute method.
 * Used within the router-v2 execution framework for complex liquidity operations.
 */
export function createLiquidityPoolInstruction(
	params: Omit<LiquidityPoolInstruction, 'type'> & { type: 'deposit' | 'withdrawal' }
): LiquidityPoolInstruction {
	return {
		...params,
		type: params.type
	};
}
