import { fetchAccountRc } from './rcSizing';
import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId, DEX_ROUTER_CONTRACT_ID } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID, EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { toChainUnits } from '$lib/currency/chainAmount';
import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';

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

/** rc_limit of a swap kept on Magi signed by a Hive wallet (see getHiveSwapOp). */
export const SWAP_ONE_HOP_RC_LIMIT = 1400;
export const SWAP_TWO_HOP_RC_LIMIT = 2400;
/** RC on top for a swap paid from the Hive wallet (return_address on HIVE). */
export const HIVE_RETURN_EXTRA_RC = 600;

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
	rawAmount: number | string,
	/** Required on the EVM bridge, which holds ETH and USDC on one contract. */
	asset?: string
): CustomJsonOperation {
	const caller = `hive:${username}`;
	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: mappingContractId,
		action: 'increaseAllowance',
		payload: JSON.stringify({
			spender: `contract:${SWAP_CONTRACT_ID}`,
			amount: String(rawAmount),
			...(asset ? { asset } : {})
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

/** The router's allowance for ETH or USDC, on the EVM bridge that holds both. */
export function getEvmAssetApproveOp(
	username: string,
	amount: CoinAmount<Coin>
): CustomJsonOperation {
	return getTokenApproveOp(username, EVM_BRIDGE_CONTRACT_ID, toChainUnits(amount), amount.coin.value);
}

/**
 * The rc_limit of a router swap signed with Hive keys (getHiveSwapOp): by
 * route for a swap kept on Magi (mainnet dry runs 11-21: one hop at most 896
 * RC, two hops 1,550; 1.5x each), 10,000 for a payout on Hive, the sized
 * payoutRcLimit for one on Bitcoin or Ethereum. A swap paid from the Hive
 * wallet (returnToHive) runs in a call the router can roll back (+403 RC on the
 * real wasm, 11-21): a HIVE input gets HIVE_RETURN_EXTRA_RC on the fixed
 * limits. An HBD input does not: the node holds rc_limit minus the free RC back
 * from an HBD draw, so a higher limit makes the draw fail; 896 + 403 still fits
 * its 1,400.
 */
export function hiveSwapRcLimit(
	assetIn: Coin,
	assetOut: Coin,
	destinationChain?: string,
	payoutRcLimit?: number,
	returnToHive?: boolean
): number {
	if ((destinationChain === 'BTC' || destinationChain === 'ETH') && payoutRcLimit != null) {
		return payoutRcLimit;
	}
	const twoHop =
		assetIn.value.toLowerCase() !== Coin.hbd.value &&
		assetOut.value.toLowerCase() !== Coin.hbd.value;
	let rcLimit = destinationChain ? 10000 : twoHop ? SWAP_TWO_HOP_RC_LIMIT : SWAP_ONE_HOP_RC_LIMIT;
	if (returnToHive && assetIn.value === Coin.hive.value) rcLimit += HIVE_RETURN_EXTRA_RC;
	return rcLimit;
}

/**
 * The RC a swap paid from the Hive wallet needs before it is signed, or null
 * when the account has it (or the node cannot say: the swap goes as before).
 * Its HIVE/HBD is deposited and drawn in the same transaction, so a failure
 * before the router can send it back leaves it in the Magi balance: an HBD
 * draw fails when the account's RC is below the rc_limit (the node holds
 * rc_limit minus the free RC back from it), and any call fails when the RC is
 * below its cost. The cost of a payout on Hive is taken as the kept-on-Magi
 * route's limit (the withdrawal adds little); a payout on Bitcoin or Ethereum
 * is sized from the account's RC already.
 */
export async function hivePaidSwapRcShortfall(
	did: string,
	assetIn: Coin,
	assetOut: Coin,
	destinationChain?: string
): Promise<{ needed: number; available: number } | null> {
	if (destinationChain === 'BTC' || destinationChain === 'ETH') return null;
	const needed =
		assetIn.value === Coin.hbd.value
			? hiveSwapRcLimit(assetIn, assetOut, destinationChain, undefined, true)
			: hiveSwapRcLimit(assetIn, assetOut, undefined, undefined, true);
	const available = await fetchAccountRc(did);
	if (available == null || available >= needed) return null;
	return { needed, available };
}

export async function getHiveSwapOp(
	username: string,
	amount: CoinAmount<Coin>,
	assetIn: Coin,
	assetOut: Coin,
	/** Smallest units of the output. Pass the exact integer string when there
	 *  is one: a Number is exact only to 2^53, and an ETH minimum (18 places)
	 *  can round up past the quote. */
	minAmountOut?: number | string,
	destinationChain?: string,
	destinationRecipient?: string,
	/** For a BTC payout: size it with `btcPayoutSwapRcLimit` (rcSizing.ts). The
	 *  payout costs ~12,000 RC since the 0.12 BTC contract, over the 10,000 used
	 *  for other destinations, so a fixed value fails it. */
	payoutRcLimit?: number,
	/** The HIVE/HBD input is deposited from Hive in this same transaction (a
	 *  swap paid from the Hive wallet, not from the Magi balance): a swap that
	 *  fails goes back to the account on Hive (the router's return_address on
	 *  HIVE), never staying in the Magi balance. */
	returnToHive?: boolean,
	/** An ETH payout's gas limit sized for its recipient (ethPayoutGasLimit). */
	payoutGasLimit?: number | null
): Promise<CustomJsonOperation> {
	if (!hasQuoteMinimum(minAmountOut)) throw new Error(SWAP_NEEDS_QUOTE_MESSAGE);
	const caller = `hive:${username}`;
	const isNative = assetIn.value === Coin.hive.value || assetIn.value === Coin.hbd.value;

	// `ref_bps` is a nil check on the contract, not a zero check, so the fee is
	// disabled by omitting the field entirely rather than sending 0.
	const feeQualifies = swapPaysAlteraFee();
	// The contract validates min_amount_out AFTER the fee comes off, so scale
	// the caller's pre-fee minimum by the same bps: slippage tolerance is then
	// measured against what the user actually receives. In BigInt, never
	// Number — an ETH minimum has 18 places and a Number is exact only to 2^53.
	const minBig =
		typeof minAmountOut === 'string' && /^\d+$/.test(minAmountOut)
			? BigInt(minAmountOut)
			: minAmountOut !== undefined && Number(minAmountOut) > 0
				? BigInt(Math.trunc(Number(minAmountOut)))
				: 0n;
	const finalMinAmountOut = feeQualifies ? applyAlteraFeeBig(minBig) : minBig;

	// A swap kept on Magi, sized by its route (mainnet dry runs 11-21): one hop
	// used at most 896 RC (BTC->HBD), two hops through HBD at most 1,550
	// (BTC->ETH); 1.5x each, as a call that runs out is charged its whole
	// rc_limit. The node also keeps rc_limit/1000 HBD back from an HBD input
	// once the free RC is spent (measured: 2,000 left 20.193 of 22.193 HBD
	// swappable, 3,000 only 19.193), so the limit stays low where HBD goes in:
	// an HBD input is always one hop (1,400, below the 2,000 it had).
	const rcLimit = hiveSwapRcLimit(assetIn, assetOut, destinationChain, payoutRcLimit, returnToHive);
	const payload: Record<string, string | number> = {
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn.value.toUpperCase(),
		asset_out: assetOut.value.toUpperCase(),
		amount_in: toChainUnits(amount),
		min_amount_out: finalMinAmountOut.toString(),
		recipient: destinationRecipient ?? caller
	};
	if (destinationChain) {
		payload.destination_chain = destinationChain;
	}
	if (destinationChain === 'ETH' && assetOut.value === Coin.eth.value && payoutGasLimit) {
		payload.payout_gas_limit = payoutGasLimit;
	}
	if (feeQualifies) {
		payload.beneficiary = ALTERA_FEE_BENEFICIARY;
		payload.ref_bps = ALTERA_FEE_BPS;
	}
	const body: Record<string, unknown> = { ...payload };
	if (returnToHive && isNative) {
		body.return_address = { chain: 'HIVE', address: caller };
	}
	const payloadStr = JSON.stringify(body);

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
