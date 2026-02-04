import type { CustomJsonOperation } from '@hiveio/dhive';
import { getCallContractOp } from './contract';

/**
 * Generic contract call operation builder for VSC contracts.
 * 
 * This is a flexible operation wrapper for calling any VSC contract method
 * with arbitrary actions and payloads. Use this for contract calls that don't
 * fit into specialized operation builders (swap, transfer, liquidity pool, etc.).
 * 
 * Supports:
 * - Router-V2 contract methods (register_pool, execute, get_schema, etc.)
 * - DEX contract methods (swap, add_liquidity, remove_liquidity, etc.)
 * - Any future VSC contract interactions
 * 
 * Based on V2 architecture: https://github.com/vsc-eco/dex-contracts/blob/main/docs/architecture-v2.md
 * 
 * @param from The account executing the contract call
 * @param contractId The VSC contract ID to call
 * @param action The contract action/method to invoke
 * @param payload The contract-specific payload object (will be JSON stringified)
 * @returns A custom_json operation ready to be broadcast
 * 
 * @example
 * // Call a query method on router-v2
 * const op = getGenericContractCallOp(
 *   'alice',
 *   'router-v2-contract-id',
 *   'get_schema',
 *   {}
 * );
 * 
 * @example
 * // Register a pool on router-v2
 * const op = getGenericContractCallOp(
 *   'alice',
 *   'router-v2-contract-id',
 *   'register_pool',
 *   {
 *     asset0: 'BTC',
 *     asset1: 'HBD',
 *     dex_contract_id: 'dex-btc-hbd-123',
 *     asset0_chain: 'BTC',
 *     asset1_chain: 'HIVE'
 *   }
 * );
 */
export function getGenericContractCallOp(
	from: string,
	contractId: string,
	action: string,
	payload: Record<string, unknown>
): CustomJsonOperation {
	// Uses default rc_limit of 10000 via getCallContractOp
	return getCallContractOp(from, contractId, action, payload);
}

/**
 * Advanced generic contract call with custom resource credit (RC) limit.
 * Use when you need fine-grained control over resource credit allocation.
 *
 * @param from The account executing the contract call
 * @param contractId The VSC contract ID to call
 * @param action The contract action/method to invoke
 * @param payload The contract-specific payload object
 * @param rcLimit Custom resource credit limit (default: 10000, max: 1000000)
 * @returns A custom_json operation ready to be broadcast
 * 
 * @example
 * // Complex swap operation with higher RC limit
 * const op = getGenericContractCallOpWithRcLimit(
 *   'alice',
 *   'router-v2-id',
 *   'execute',
 *   { instruction, amount_in: 1000000 },
 *   50000 // Higher RC for complex operation
 * );
 */
export function getGenericContractCallOpWithRcLimit(
	from: string,
	contractId: string,
	action: string,
	payload: Record<string, unknown>,
	rcLimit: number
): CustomJsonOperation {
	const jsonOutput = {
		action,
		contract_id: contractId,
		payload: JSON.stringify(payload),
		rc_limit: rcLimit,
		intents: [],
		type: 'call'
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

/**
 * Generic contract call with optional VSC intents support.
 * Use for complex operations that need to declare VSC intents or atomic operations.
 *
 * Intents allow specifying dependencies or atomic execution requirements
 * for multi-step contract operations on VSC.
 *
 * @param from The account executing the contract call
 * @param contractId The VSC contract ID to call
 * @param action The contract action/method to invoke
 * @param payload The contract-specific payload object
 * @param intents Optional VSC intents for atomic or dependent operations
 * @param rcLimit Optional resource credit limit (default: 10000)
 * @returns A custom_json operation ready to be broadcast
 * 
 * @example
 * // Multi-step operation with intents
 * const op = getGenericContractCallOpWithIntents(
 *   'alice',
 *   'router-v2-id',
 *   'execute',
 *   { instruction, amount_in: 1000000 },
 *   ['swap_intent_1', 'claim_intent_2'], // Declare dependencies
 *   50000
 * );
 */
export function getGenericContractCallOpWithIntents(
	from: string,
	contractId: string,
	action: string,
	payload: Record<string, unknown>,
	intents: unknown[] = [],
	rcLimit: number = 10000
): CustomJsonOperation {
	const jsonOutput = {
		action,
		contract_id: contractId,
		payload: JSON.stringify(payload),
		rc_limit: rcLimit,
		intents,
		type: 'call'
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
