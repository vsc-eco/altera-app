import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId, DEX_ROUTER_CONTRACT_ID } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';

export const ALTERA_FEE_BENEFICIARY = 'hive:altera.app';
export const ALTERA_FEE_BPS = 25;

/**
 * Master switch for the Altera exchange fee.
 *
 * OFF for now. Turning it on is a separate, deliberate change — the policy
 * below is implemented either way so that the switch is the only thing left
 * to flip, and so the card already shows what the transaction will do.
 */
export const ALTERA_FEE_ACTIVE = false;

/**
 * Does this swap pay the Altera fee?
 *
 * **Every swap does, while the fee is active.** Any input asset, any output
 * asset, any destination — kept on Magi included. No minimum and no cap.
 *
 * It used to be far narrower, and wrong against the policy: it charged only
 * when the output LEFT Magi, never when the output was HIVE or HBD, and never
 * for inputs other than HIVE/HBD/BTC, so ETH and custom tokens were free. It
 * also looked up a USD price to compare against a $100 threshold that had
 * already been set to 0 — a price call that could fail, on a path where
 * failing meant silently not charging.
 *
 * Charged ONCE per swap. That is the contract's doing, not ours: the pool
 * takes `ref_bps` from the swap's final output, and on a two-hop route the
 * router passes `beneficiary`/`ref_bps` on the second hop only.
 *
 * Deliberately takes no arguments. Five places used to hold their own copy of
 * a fee rule and they had drifted apart; there is nothing left to disagree
 * about.
 */
export function swapPaysAlteraFee(): boolean {
	return ALTERA_FEE_ACTIVE;
}

/** The fee as a percentage, for display. 0 while the switch is off. */
export function alteraFeePct(): number {
	return ALTERA_FEE_ACTIVE ? ALTERA_FEE_BPS / 100 : 0;
}

/**
 * Take the fee off an output amount in smallest units.
 *
 * The contract checks `min_amount_out` AFTER the fee comes off, so the same
 * reduction has to be applied to the minimum we send and to the figures the
 * card shows — otherwise the card promises 0.25% more than the swap can pay.
 *
 * UNCONDITIONAL on purpose: whether the fee applies is `swapPaysAlteraFee()`,
 * and the caller asks that separately. `buildRouterInstruction` is TOLD
 * whether the fee applies, as a parameter, so a version of this that also
 * re-read the global switch quietly stopped scaling for it.
 */
export function applyAlteraFee(amountSmallestUnits: number): number {
	return Math.floor((amountSmallestUnits * (10000 - ALTERA_FEE_BPS)) / 10000);
}

/** The same reduction for the bigint amounts the swap quote works in. */
export function applyAlteraFeeBig(amountSmallestUnits: bigint): bigint {
	return (amountSmallestUnits * BigInt(10000 - ALTERA_FEE_BPS)) / 10000n;
}

/**
 * DEX Router — handles all swap types (HIVE/HBD, BTC/HBD, BTC/HIVE multi-hop).
 * All swaps go through the router which auto-discovers the correct pool.
 * Re-exported here for backwards compatibility with existing imports.
 */
export const SWAP_CONTRACT_ID = DEX_ROUTER_CONTRACT_ID;

/**
 * A router swap goes out only with the quote's min_amount_out. Without a quote
 * (pool prices did not load) the router would take any price, and the pool fee
 * has no cap of its own. A quote whose minimum rounds to 0 (a dust swap) is
 * still a quote; only a missing one is refused.
 */
export const SWAP_NEEDS_QUOTE_MESSAGE =
	'Prices have not loaded yet, so this swap would have no price protection. Wait a moment or retry.';

export function hasQuoteMinimum(min: string | number | undefined | null): boolean {
	if (min === undefined || min === null || min === '') return false;
	const n = Number(min);
	return Number.isFinite(n) && n >= 0;
}

/**
 * Grants the DEX router allowance to spend exactly `amount` BTC (in SATS)
 * on the mapping contract. Uses `increaseAllowance` so the allowance is
 * additive per operation and matches the liquidity/swap amount being
 * consumed, rather than approving an arbitrarily large number.
 *
 * `CoinAmount.amount` for BTC is already in SATS (decimalPlaces = 8), so
 * it's passed through as the base-unit value the contract expects.
 */
export function getBtcApproveOp(
	username: string,
	amount: CoinAmount<typeof Coin.btc>
): CustomJsonOperation {
	return getTokenApproveOp(username, BTC_MAPPING_CONTRACT_ID, amount.amount);
}

/**
 * Grants the DEX router allowance to spend `rawAmount` (smallest units) of a
 * mapped asset held on `mappingContractId`.
 *
 * Every non-native swap input needs this: the router moves the funds with
 * `transferFrom` on the mapping contract, so without an allowance the swap
 * aborts. Native HIVE/HBD skip it — they use a `transfer.allow` intent on the
 * swap op instead.
 *
 * The spender is `contract:<router-id>`, NOT the router's owner account: the
 * caller the mapping contract sees when the router calls `transferFrom` is the
 * router contract itself. `increaseAllowance` keeps the grant additive and
 * sized to the exact amount being spent rather than approving an open-ended
 * number.
 */
export function getTokenApproveOp(
	username: string,
	mappingContractId: string,
	rawAmount: number | string
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: mappingContractId,
		action: 'increaseAllowance',
		payload: JSON.stringify({
			spender: `contract:${SWAP_CONTRACT_ID}`,
			amount: String(rawAmount)
		}),
		rc_limit: 1000,
		intents: [] as Array<{ type: string; args: Record<string, string> }>
	};
	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(op)
		}
	];
}

export async function getHiveSwapOp(
	username: string,
	amount: CoinAmount<Coin>,
	assetIn: Coin,
	assetOut: Coin,
	minAmountOut?: number,
	destinationChain?: string,
	destinationRecipient?: string,
	/** For a BTC payout: size it with `btcPayoutSwapRcLimit` (rcSizing.ts). The
	 *  payout costs ~12,000 RC since the 0.12 BTC contract, over the 10,000 used
	 *  for other destinations, so a fixed value fails it. */
	payoutRcLimit?: number
): Promise<CustomJsonOperation> {
	if (!hasQuoteMinimum(minAmountOut)) throw new Error(SWAP_NEEDS_QUOTE_MESSAGE);
	const caller = `hive:${username}`;
	const isNative = assetIn.value === Coin.hive.value || assetIn.value === Coin.hbd.value;

	// `ref_bps` is a nil check on the contract, not a zero check, so the fee is
	// disabled by omitting the field entirely rather than sending 0.
	const feeQualifies = swapPaysAlteraFee();
	// The contract validates min_amount_out AFTER the fee comes off, so scale
	// the caller's pre-fee minimum by the same bps: slippage tolerance is then
	// measured against what the user actually receives.
	const finalMinAmountOut =
		feeQualifies && minAmountOut !== undefined ? applyAlteraFee(minAmountOut) : minAmountOut;

	// TODO: estimate RC usage
	let rcLimit = 2000;
	const payload: Record<string, string | number> = {
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn.value.toUpperCase(),
		asset_out: assetOut.value.toUpperCase(),
		amount_in: String(amount.amount),
		min_amount_out: finalMinAmountOut ? String(finalMinAmountOut) : '0',
		recipient: destinationRecipient ?? caller
	};
	if (destinationChain) {
		payload.destination_chain = destinationChain;
		rcLimit = 10000;
		if (destinationChain === 'BTC' && payoutRcLimit != null) {
			rcLimit = payoutRcLimit;
		}
	}
	if (feeQualifies) {
		payload.beneficiary = ALTERA_FEE_BENEFICIARY;
		payload.ref_bps = ALTERA_FEE_BPS;
	}
	const payloadStr = JSON.stringify(payload);

	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: SWAP_CONTRACT_ID,
		action: 'execute',
		payload: payloadStr,
		rc_limit: rcLimit,
		intents: isNative
			? [
					{
						type: 'transfer.allow',
						args: { limit: amount.toAmountString(true), token: assetIn.value }
					}
				]
			: ([] as Array<{ type: string; args: Record<string, string> }>)
	};

	return [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(op)
		}
	];
}
