/**
 * Size a contract call's `rc_limit` from a dry run instead of hardcoding it.
 *
 * A fixed limit breaks as soon as a call's cost depends on chain state. The
 * BTC `unmap` is the case that forced this: it spends one input per vault
 * UTXO it has to chain, so with the vault's confirmed pool fragmented into
 * small UTXOs an 80,000-sat withdrawal costs ~19,000 RC. Every mainnet unmap
 * sent with the old fixed `rc_limit: 10000` hit `gas_limit_hit` and failed on
 * chain, even for users holding twice that much RC.
 *
 * The node runs a Hive-origin call with `min(available RC, rc_limit)` gas and
 * charges only what it uses, so the limit is a cap, not a price. We simulate
 * at the most the node would ever allow, then broadcast with the measured
 * cost plus a margin, clamped to what the account actually has.
 */

import { ActiveConsensusStore, GetAccountBalanceStore, SimulateContractCallsStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { rcShortfallToHbd } from '$lib/calc';

// ⚠️ The RC arithmetic itself — the limits, the margin, the sizing and the
// RC→HBD conversion — lives in `$lib/calc` (§7 Resource credits), with every
// other calculation in the app. This module is the node round-trips around it.
export {
	MAX_RC_LIMIT,
	RC_MARGIN,
	BTC_PAYOUT_SWAP_MIN_RC,
	BTC_PAYOUT_SWAP_MIN_RC_V0_15,
	WRITE_PRICE_CUT_CONSENSUS,
	btcPayoutSwapMinRc,
	sizeRcLimit,
	btcPayoutSwapRcLimit
} from '$lib/calc';
export type { ActiveConsensus, InsufficientRc, RcSizing } from '$lib/calc';

import {
	MAX_RC_LIMIT,
	BTC_PAYOUT_SWAP_MIN_RC,
	btcPayoutSwapMinRc,
	sizeRcLimit,
	btcPayoutSwapRcLimit,
	type ActiveConsensus,
	type InsufficientRc,
	type RcSizing
} from '$lib/calc';

/** The chain's active consensus version (the node's newest election), or
 *  undefined when the node does not answer. Every node reports the on-chain
 *  election, so the answer does not depend on which build the node runs. */
export async function fetchActiveConsensus(): Promise<ActiveConsensus | undefined> {
	try {
		const res = await queryOnce(new ActiveConsensusStore(), { policy: 'NetworkOnly' });
		const el = res.data?.electionByBlockHeight;
		if (el?.protocol_version == null || el?.version_major == null) return undefined;
		return { major: Number(el.version_major), consensus: Number(el.protocol_version) };
	} catch {
		return undefined;
	}
}

/** btcPayoutSwapMinRc for the chain as it is now. */
export async function fetchBtcPayoutSwapMinRc(): Promise<number> {
	return btcPayoutSwapMinRc(await fetchActiveConsensus());
}

/** The fresh RC (the node's getAccountRC) when the node answers, else
 *  `fallbackAvailable` (the polled balance store), sized by btcPayoutSwapRcLimit
 *  against the minimum of the chain's active consensus version. */
export async function sizeBtcPayoutSwap(
	did: string,
	hbdPulledFromMagi: number,
	fallbackAvailable?: number,
	/** True when the input is ETH or USDC (isEvmBridgeCoin): such payouts cost
	 *  more (btcPayoutMinRcForInput). */
	evmBridgeInput = false,
	/** RC on top for a swap paid from the Hive wallet (HIVE_RETURN_PAYOUT_EXTRA_RC). */
	extraRc = 0
): Promise<RcSizing> {
	const [fresh, minRc] = await Promise.all([fetchAccountRc(did), fetchBtcPayoutSwapMinRc()]);
	return btcPayoutSwapRcLimit(
		fresh ?? fallbackAvailable ?? 0,
		hbdPulledFromMagi,
		btcPayoutMinRcForInput(minRc, evmBridgeInput) + extraRc
	);
}

/**
 * RC on top of a payout's minimum when the swap is paid from the Hive wallet:
 * the router runs it in a call to itself it can roll back, so a failure goes
 * back to Hive. Measured on the real wasm 11-21: +403 RC for the call, +745
 * for an Ethereum payout (which also prices the floor of a swap back); 1.5x
 * the larger. A payout that runs out of RC cannot be sent back.
 */
export const HIVE_RETURN_PAYOUT_EXTRA_RC = 1_200;

/**
 * What a BTC payout costs on top when its input is ETH or USDC: the router
 * also pulls it from the EVM bridge (transferFrom) and swaps it into HBD first.
 * Measured on testnet at 0.15, 2026-11-19: ETH -> HBD -> BTC 6,544 RC against
 * 5,487 for HBD -> BTC (+1,057). USDC takes the same pull and hop (the testnet
 * USDC pool is too small to dry-run a payout). The hop writes no new bytes, so
 * the difference is the same up to 0.14. Added to the version's minimum, which
 * already holds room for one more vault input.
 */
export const BTC_PAYOUT_EVM_INPUT_EXTRA_RC = 1_000;

/** The payout minimum for this input: the version's minimum, plus the bridge
 *  pull and the extra hop when the input is ETH or USDC (isEvmBridgeCoin). */
export function btcPayoutMinRcForInput(minRc: number, evmBridgeInput: boolean): number {
	return evmBridgeInput ? minRc + BTC_PAYOUT_EVM_INPUT_EXTRA_RC : minRc;
}

/** What to tell a user whose RC cannot pay a BTC payout. The amount swapped
 *  barely changes the cost, so a smaller swap does not help; HBD on Magi does.
 *  The sizing functions above always fill `needed` with the minimum they
 *  refused at; without it the higher minimum is quoted. */
/**
 * Least RC a swap paid out on Ethereum needs (destination_chain ETH: the
 * router's swap, then the EVM bridge's unmapETH / unmapERC20). Mainnet dry
 * runs 11-21 at consensus 0.15: HBD->USDC 2,951-3,700 RC, HBD->ETH 3,785,
 * BTC->USDC (two hops) 4,589. 1.2x the most, as the BTC payout's 6,200 is to
 * its ~5,300: higher would refuse payouts the account can pay (it gets all
 * its spendable RC); a call that runs out is charged its whole rc_limit.
 */
export const EVM_PAYOUT_SWAP_MIN_RC = 5_500;

/** btcPayoutSwapRcLimit with the Ethereum payout's minimum, on fresh RC. */
export async function sizeEvmPayoutSwap(
	did: string,
	hbdPulledFromMagi: number,
	fallbackAvailable?: number,
	/** RC on top for a swap paid from the Hive wallet (HIVE_RETURN_PAYOUT_EXTRA_RC). */
	extraRc = 0
): Promise<RcSizing> {
	const fresh = await fetchAccountRc(did);
	return btcPayoutSwapRcLimit(
		fresh ?? fallbackAvailable ?? 0,
		hbdPulledFromMagi,
		EVM_PAYOUT_SWAP_MIN_RC + extraRc
	);
}

export function evmPayoutShortfallMessage(shortfall: InsufficientRc): string {
	const needed = shortfall.needed ?? EVM_PAYOUT_SWAP_MIN_RC;
	const missingHbd = Math.ceil(Math.max(0, needed - shortfall.available) / 10) / 100;
	return (
		`Not enough RC to pay out to an Ethereum address: it needs at least ` +
		`${needed.toLocaleString('en-US')} RC and you have ` +
		`${shortfall.available.toLocaleString('en-US')}. Deposit at least ` +
		`${missingHbd.toFixed(2)} HBD to Magi to cover it.`
	);
}

export function btcPayoutShortfallMessage(shortfall: InsufficientRc): string {
	const needed = shortfall.needed ?? BTC_PAYOUT_SWAP_MIN_RC;
	const missingHbd = rcShortfallToHbd(needed, shortfall.available);
	return (
		`Not enough RC to pay out to a Bitcoin address: it needs at least ` +
		`${needed.toLocaleString('en-US')} RC and you have ` +
		`${shortfall.available.toLocaleString('en-US')}. Deposit at least ` +
		`${missingHbd.toFixed(2)} HBD to Magi to cover it.`
	);
}

/** The account's spendable RC now (the node's getAccountRC), or undefined when
 *  the node does not answer. */
export async function fetchAccountRc(did: string): Promise<number | undefined> {
	try {
		const res = await queryOnce(new GetAccountBalanceStore(), {
			variables: { account: did },
			policy: 'NetworkOnly'
		});
		const amount = res.data?.getAccountRC?.amount;
		return amount == null ? undefined : Number(amount);
	} catch {
		return undefined;
	}
}

/** The node's error code when a call runs out of its `rc_limit`. */
const GAS_LIMIT_HIT = 'gas_limit_hit';

export type RcEstimate =
	| { ok: true; rcLimit: number; rcUsed: number; available: number }
	| InsufficientRc
	| { ok: false; reason: 'call-fails'; error: string }
	| { ok: false; reason: 'unavailable'; error: string };

type SimResult = {
	success: boolean;
	err?: string | null;
	err_msg?: string | null;
	rc_used: number;
};

/**
 * Turn a dry-run result into a broadcast decision. Pure, so the branches are
 * unit-tested without a node.
 *
 * - success → size the limit from `rc_used`.
 * - `gas_limit_hit` → the call needs more RC than the account has. The node
 *   stops at the cap, so the real cost is unknown — only that it's higher.
 * - any other failure → the call itself would fail (e.g. balance too low);
 *   pass the node's message through rather than burning RC on a sure failure.
 */
export function interpretSimulation(sim: SimResult, available: number): RcEstimate {
	if (sim.success) {
		const sizing = sizeRcLimit(sim.rc_used, available);
		if (!sizing.ok) return sizing;
		return { ok: true, rcLimit: sizing.rcLimit, rcUsed: sim.rc_used, available };
	}
	if (sim.err === GAS_LIMIT_HIT) {
		return { ok: false, reason: 'insufficient-rc', available: Math.floor(available) };
	}
	return { ok: false, reason: 'call-fails', error: sim.err_msg || sim.err || 'unknown error' };
}

/** RC is the account's Magi-ledger HBD (in milli-HBD) plus a free allowance,
 *  so a shortfall of N RC is N/1000 HBD to deposit. */
export function rcShortfallMessage(shortfall: InsufficientRc, what: string): string {
	const fmt = (n: number) => n.toLocaleString('en-US');
	const have = fmt(shortfall.available);
	if (shortfall.needed == null) {
		return (
			`Not enough RC for this ${what}: it needs more than the ${have} RC you have. ` +
			`Deposit HBD to Magi to raise your RC, or try a smaller amount.`
		);
	}
	const missingHbd = rcShortfallToHbd(shortfall.needed, shortfall.available);
	return (
		`Not enough RC for this ${what}: it needs ${fmt(shortfall.needed)} RC and you have ` +
		`${have}. Deposit at least ${missingHbd.toFixed(2)} HBD to Magi to cover it, ` +
		`or try a smaller amount.`
	);
}

/**
 * Dry-run one contract call as `callerDid` and size its `rc_limit`.
 *
 * Only for calls WITHOUT an HBD `transfer.allow` intent: with one, a high
 * `rc_limit` reserves HBD against RC before the intent pull and the dry run
 * fails with a spurious "insufficient balance".
 */
export async function estimateCallRc(args: {
	callerDid: string;
	contractId: string;
	action: string;
	payload: string;
}): Promise<RcEstimate> {
	try {
		const res = await queryOnce(new SimulateContractCallsStore(), {
			variables: {
				account: args.callerDid,
				input: {
					tx_id: `altera-sim-${Date.now()}`,
					required_auths: [args.callerDid],
					calls: [
						{
							contract_id: args.contractId,
							action: args.action,
							payload: args.payload,
							// The node gives the call min(available, rc_limit) gas,
							// so the schema maximum simulates "everything you have".
							rc_limit: MAX_RC_LIMIT
						}
					]
				}
			},
			policy: 'NetworkOnly'
		});
		const sim = res.data?.simulateContractCalls?.[0];
		const available = res.data?.getAccountRC?.amount;
		if (!sim || available == null) {
			return { ok: false, reason: 'unavailable', error: 'empty simulation response' };
		}
		return interpretSimulation(sim, available);
	} catch (err) {
		return {
			ok: false,
			reason: 'unavailable',
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
