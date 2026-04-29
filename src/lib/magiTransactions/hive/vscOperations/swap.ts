import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId, DEX_ROUTER_CONTRACT_ID } from '../../../../client';
import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';

export const ALTERA_FEE_BENEFICIARY = 'hive:altera.app';
export const ALTERA_FEE_BPS = 25;
export const ALTERA_FEE_USD_THRESHOLD = 0;
/**
 * Master switch for the Altera exchange fee.
 * Set to true to start charging ALTERA_FEE_BPS on qualifying swaps
 * and show the amber fee badge in the UI.
 * Set to false → fee is not charged and the UI shows "Free" (green).
 */
export const ALTERA_FEE_ACTIVE = false;

/**
 * Returns the exchange fee percentage to display in the UI for a given swap pair.
 *
 * - HIVE/HBD → BTC: ALTERA_FEE_ACTIVE ? ALTERA_FEE_BPS/100 : 0  (amber when >0, green "Free" when 0)
 * - BTC → HIVE/HBD: always 0  ("Free" — Altera never charges on BTC purchases)
 * - HIVE ↔ HBD:     null       (row hidden — no Altera fee applies)
 *
 * To change the fee rate: update ALTERA_FEE_BPS.
 * To enable/disable:      flip ALTERA_FEE_ACTIVE.
 */
export function getAlteraFeePct(assetIn: string, assetOut: string): number | null {
	const aIn = assetIn.toLowerCase();
	const aOut = assetOut.toLowerCase();
	const effectivePct = ALTERA_FEE_ACTIVE ? ALTERA_FEE_BPS / 100 : 0;
	if (aOut === 'btc') return effectivePct;
	if (aIn === 'btc') return 0; // BTC → HIVE/HBD always free
	return null; // HIVE ↔ HBD — no Altera fee
}

/**
 * Altera charges a UI usage fee on swaps that leave the Hive/Magi ecosystem
 * to a non-HIVE, non-HBD mainnet target when the input value is at least
 * $100 USD. Prices come from the same v4v feed the UI already uses.
 */
export async function qualifiesForAlteraFee(
	amountIn: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>,
	assetOut: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc,
	destinationChain?: string
): Promise<boolean> {
	if (!destinationChain || destinationChain === 'MAGI') return false;
	if (assetOut.value === Coin.hive.value || assetOut.value === Coin.hbd.value) return false;

	const prices = await getCryptoPrices();
	let usdPerUnit: number;
	switch (amountIn.coin.value) {
		case Coin.hive.value:
			usdPerUnit = prices.hive.usd;
			break;
		case Coin.hbd.value:
			usdPerUnit = prices.hive_dollar.usd;
			break;
		case Coin.btc.value:
			usdPerUnit = prices.bitcoin.usd;
			break;
		default:
			return false;
	}
	if (!Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return false;
	const usdValue = amountIn.toNumber() * usdPerUnit;
	return usdValue >= ALTERA_FEE_USD_THRESHOLD;
}

/**
 * DEX Router — handles all swap types (HIVE/HBD, BTC/HBD, BTC/HIVE multi-hop).
 * All swaps go through the router which auto-discovers the correct pool.
 * Re-exported here for backwards compatibility with existing imports.
 */
export const SWAP_CONTRACT_ID = DEX_ROUTER_CONTRACT_ID;

type SwapCoin = typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc;

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
	const caller = `hive:${username}`;
	const op = {
		net_id: vscNetworkId,
		caller,
		contract_id: BTC_MAPPING_CONTRACT_ID,
		action: 'increaseAllowance',
		payload: JSON.stringify({
			spender: `contract:${SWAP_CONTRACT_ID}`,
			amount: String(amount.amount)
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
	amount: CoinAmount<SwapCoin>,
	assetIn: SwapCoin,
	assetOut: SwapCoin,
	minAmountOut?: number,
	destinationChain?: string,
	destinationRecipient?: string
): Promise<CustomJsonOperation> {
	const caller = `hive:${username}`;
	const isNative = assetIn.value === Coin.hive.value || assetIn.value === Coin.hbd.value;

	// Gated by ALTERA_FEE_ACTIVE — set that to true (and restore the real call below)
	// to re-enable. Note: refBps is a nil check on the contract, not a zero check,
	// so we cannot disable by setting BPS to 0; we must omit the field entirely.
	// const feeQualifies = await qualifiesForAlteraFee(amount, assetOut, destinationChain);
	const feeQualifies = ALTERA_FEE_ACTIVE && await qualifiesForAlteraFee(amount, assetOut, destinationChain);
	// Contract validates min_amount_out AFTER the referral/altera deduction.
	// Scale the caller's pre-fee min down by the same bps so slippage
	// tolerance is measured against what the user actually receives.
	const finalMinAmountOut =
		feeQualifies && minAmountOut !== undefined
			? Math.floor((minAmountOut * (10000 - ALTERA_FEE_BPS)) / 10000)
			: minAmountOut;

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
