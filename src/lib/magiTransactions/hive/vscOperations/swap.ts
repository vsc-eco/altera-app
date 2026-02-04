import type { CustomJsonOperation } from '@hiveio/dhive';
import { getCallContractOp } from './contract';
import type { DexExecutePayload, DexInstruction } from './vsc-op-types';

/**
 * Generic wrapper for swap-related contract calls on VSC.
 * Routes through router-v2 for swaps via the execute method.
 * 
 * Based on V2 architecture: https://github.com/vsc-eco/dex-contracts/blob/main/docs/architecture-v2.md
 * Router-V2 supports direct swaps and two-hop swaps automatically.
 */
export function getSwapCallContractOp(
	from: string,
	routerV2ContractId: string,
	action: string,
	payload: Record<string, unknown>
): CustomJsonOperation {
	return getCallContractOp(from, routerV2ContractId, action, payload);
}

/**
 * Helper to build a DEX swap instruction object that matches the
 * DEX router instruction schema (instruction-schema.md).
 * 
 * Instruction schema with required fields:
 * - type: 'swap' for swap operations
 * - version: API version (e.g., '1.0.0')
 * - asset_in: Input asset identifier
 * - asset_out: Output asset identifier
 * - recipient: Hive account to receive output
 * 
 * Optional fields for advanced control:
 * - slippage_bps: Max slippage in basis points (100 = 1%)
 * - min_amount_out: Minimum output amount with slippage protection
 * - beneficiary: Referral beneficiary account
 * - ref_bps: Referral fee in basis points
 * - return_address: Return address with chain for refunds (required for cross-chain)
 * - metadata: Additional operation metadata
 */
export function createDexSwapInstruction(params: DexInstruction): DexInstruction {
	return {
		...params,
		type: 'swap'
	};
}

/**
 * High-level helper that wraps a DEX swap instruction and amount into
 * a router-v2 `execute` call, sent as a VSC `call` custom_json op.
 *
 * This follows the architecture where the router contract exposes
 * an `execute` method that accepts DEX instructions with routing logic:
 * - Direct Swap: If a pool exists for the asset pair, route directly
 * - Two-Hop Swap: If no direct pool, route via HBD (e.g., BTC -> HBD -> HIVE)
 * 
 * The amount_in parameter is the input amount in the smallest unit
 * (e.g., satoshis for BTC, cents for USD).
 *
 * @param from The account executing the swap
 * @param routerV2ContractId The router-v2 contract ID
 * @param instruction The DEX swap instruction with asset_in, asset_out, etc.
 * @param amountIn The input amount in smallest unit
 * @returns A custom_json operation for router-v2 execute
 * 
 * @example
 * // Simple BTC to HBD swap
 * const instruction = createDexSwapInstruction({
 *   type: 'swap',
 *   version: '1.0.0',
 *   asset_in: 'BTC',
 *   asset_out: 'HBD',
 *   recipient: 'alice',
 *   slippage_bps: 100 // 1% max slippage
 * });
 * const op = getDexSwapCallOp('alice', 'router-v2-123', instruction, 1000000);
 * 
 * @example
 * // Swap with return address for CEX refund safety
 * const instruction = createDexSwapInstruction({
 *   type: 'swap',
 *   version: '1.0.0',
 *   asset_in: 'ETH',
 *   asset_out: 'HBD',
 *   recipient: 'alice',
 *   return_address: {
 *     chain: 'ETH',
 *     address: '0x1234567890abcdef...'
 *   }
 * });
 * const op = getDexSwapCallOp('alice', 'router-v2-123', instruction, 2000000000000000000);
 */
export function getDexSwapCallOp(
	from: string,
	routerV2ContractId: string,
	instruction: DexInstruction,
	amountIn: number
): CustomJsonOperation {
	const payload: DexExecutePayload = {
		instruction,
		amount_in: amountIn
	};

	return getSwapCallContractOp(from, routerV2ContractId, 'execute', payload);
}

