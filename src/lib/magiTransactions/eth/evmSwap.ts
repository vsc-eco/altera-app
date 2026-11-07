/**
 * What an EVM-wallet (L2-signed) transaction must declare, and the swap it sends.
 * Pure, so the rules are unit-tested without a wallet or a node.
 */

import type { CallContractTransaction, Transaction } from './client';
import { btcPayoutSwapRcLimit, type RcSizing } from '../hive/vscOperations/rcSizing';

/**
 * The per-op worst case the node's mempool adds up (transaction-pool
 * StaticMaxRcCost, go-vsc-node modules/transaction-pool/utils.go). A transaction
 * whose header rc_limit is below the sum is refused with "rc_limit insufficient
 * for declared ops".
 */
const OP_RC_COST: Record<string, number> = {
	transfer: 100,
	withdraw: 200,
	stake_hbd: 200,
	unstake_hbd: 200
};
const CALL_RC_MIN = 100;
const UNKNOWN_OP_RC = 50;

/** The header every EVM transaction declared before this rule existed; kept as
 *  the floor so a transaction that already passed declares the same limit. */
const HEADER_RC_FLOOR = 1000;

/** The header rc_limit for these ops: what the node requires, never below the floor. */
export function headerRcLimit(txs: Transaction[]): number {
	let total = 0;
	for (const tx of txs) {
		if (tx.op === 'call') {
			total += Math.max(tx.payload.rc_limit, CALL_RC_MIN);
		} else {
			total += OP_RC_COST[tx.op] ?? UNKNOWN_OP_RC;
		}
	}
	return Math.max(total, HEADER_RC_FLOOR);
}

/** rc_limit of the allowance grant a mapped-asset swap input needs. */
export const EVM_APPROVE_RC_LIMIT = 1000;
/** The most a swap that stays on Magi declares. */
export const EVM_SWAP_MAX_RC = 10_000;
/** Below this a swap that stays on Magi is refused before signing. */
export const EVM_SWAP_MIN_RC = 1000;

/**
 * The swap's rc_limit for an EVM account. It has no free RC, so the node reserves the
 * whole rc_limit out of its HBD before an HBD intent pull: the limit must leave the
 * input amount spendable, and the node refuses a header above the account's RC.
 *
 * @param hbdPulledFromMagi the input in milli-HBD when it is HBD, else 0
 * @param approveRc         rc_limit of the allowance op sent with it, else 0
 */
export function evmSwapRcLimit(
	available: number,
	hbdPulledFromMagi: number,
	approveRc: number,
	btcPayout: boolean
): RcSizing {
	const afterApprove = available - approveRc;
	if (btcPayout) return btcPayoutSwapRcLimit(afterApprove, hbdPulledFromMagi);
	const spendable = Math.floor(afterApprove - Math.max(0, hbdPulledFromMagi));
	if (spendable < EVM_SWAP_MIN_RC) {
		return {
			ok: false,
			reason: 'insufficient-rc',
			needed: EVM_SWAP_MIN_RC,
			available: Math.max(0, spendable)
		};
	}
	return { ok: true, rcLimit: Math.min(spendable, EVM_SWAP_MAX_RC) };
}

export type EvmSwapInput =
	/** HIVE/HBD on the Magi ledger: the router draws it under a transfer.allow intent. */
	| { kind: 'native'; token: string; limit: string }
	/** A mapped asset: the router moves it with transferFrom, so it needs an allowance. */
	| { kind: 'mapped'; mappingContractId: string; rawAmount: string };

/** The ops of a DEX router swap signed by an EVM wallet, in the order they must run. */
export function buildEvmSwapOps(args: {
	caller: string;
	routerId: string;
	instruction: string;
	rcLimit: number;
	input: EvmSwapInput;
}): CallContractTransaction[] {
	const { caller, routerId, instruction, rcLimit, input } = args;
	const swap: CallContractTransaction = {
		op: 'call',
		payload: {
			contract_id: routerId,
			action: 'execute',
			payload: instruction,
			rc_limit: rcLimit,
			intents:
				input.kind === 'native'
					? [{ type: 'transfer.allow', args: { limit: input.limit, token: input.token } }]
					: [],
			caller
		}
	};
	if (input.kind === 'native') return [swap];
	const approve: CallContractTransaction = {
		op: 'call',
		payload: {
			contract_id: input.mappingContractId,
			action: 'increaseAllowance',
			payload: JSON.stringify({ spender: `contract:${routerId}`, amount: input.rawAmount }),
			rc_limit: EVM_APPROVE_RC_LIMIT,
			intents: [],
			caller
		}
	};
	return [approve, swap];
}
