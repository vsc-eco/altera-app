import type { CustomJsonOperation, TransferOperation } from '@hiveio/dhive';
import { CoinAmount } from '../currency/CoinAmount.js';
import type { DestinationChain, MagiConfig, ReferralConfig, SwapAsset } from '../types/index.js';

/**
 * Build the L1 → Magi deposit operation. Sends `amount` of HIVE or HBD from
 * the user's Hive L1 account to the Magi gateway account with a memo that
 * tells the gateway to credit `toDid` on Magi.
 *
 * Ported from altera-app/src/lib/magiTransactions/hive/vscOperations/deposit.ts.
 */
export function getHiveDepositOp(params: {
	from: string;
	toDid: string;
	amount: CoinAmount;
	config: MagiConfig;
	extraMemoParams?: URLSearchParams;
}): TransferOperation {
	const { from, toDid, amount, config, extraMemoParams } = params;
	if (amount.asset !== 'HIVE' && amount.asset !== 'HBD') {
		throw new Error(`getHiveDepositOp: asset must be HIVE or HBD, got ${amount.asset}`);
	}
	const chainUnit =
		amount.asset === 'HBD'
			? (config.hbdAssetName ?? 'HBD')
			: (config.hiveAssetName ?? 'HIVE');
	const defaultMemo = new URLSearchParams(`to=${toDid.split(':').at(-1) ?? ''}`);
	const memo = extraMemoParams
		? new URLSearchParams([...defaultMemo, ...extraMemoParams])
		: defaultMemo;
	return [
		'transfer',
		{
			from,
			to: config.gatewayAccount,
			amount: `${amount.toDecimalString()} ${chainUnit}`,
			memo: memo.toString()
		}
	];
}

/**
 * Build the DEX-router swap call as a Hive `custom_json` operation.
 *
 * For HIVE/HBD input, a `transfer.allow` intent is attached (native allowance).
 * For BTC input, the intent is empty — caller must separately emit
 * `getBtcApproveOp` before this op in the same tx.
 *
 * When `referral` is provided AND the swap qualifies (destination_chain is set
 * and output asset is not HIVE/HBD), the `beneficiary` + `ref_bps` fields are
 * added to the payload and `minAmountOut` is scaled down by `bps` to match
 * what the router will actually deliver after the referral fee skim.
 *
 * Ported from altera-app/src/lib/magiTransactions/hive/vscOperations/swap.ts
 * (commit 6ff1104 — "inject Altera referral fee on outbound mainnet swaps").
 */
export function getHiveSwapOp(params: {
	username: string;
	amountIn: CoinAmount;
	assetIn: SwapAsset;
	assetOut: SwapAsset;
	minAmountOut?: bigint;
	destinationChain?: DestinationChain;
	destinationRecipient?: string;
	config: MagiConfig;
	/** Override the referral config for this op. Defaults to `config.referral`. */
	referralOverride?: ReferralConfig | null;
	/**
	 * Independent decision — the caller supplies whether the swap
	 * qualifies for a referral fee. Computed externally because it
	 * requires a price lookup which is not this function's job.
	 */
	referralQualifies?: boolean;
}): CustomJsonOperation {
	const {
		username,
		amountIn,
		assetIn,
		assetOut,
		minAmountOut,
		destinationChain,
		destinationRecipient,
		config,
		referralQualifies
	} = params;

	const referral =
		params.referralOverride === undefined ? config.referral : params.referralOverride;

	const caller = `hive:${username}`;
	const isNative = assetIn === 'HIVE' || assetIn === 'HBD';

	const feeActive = !!(referral && referralQualifies);
	const finalMinAmountOut =
		feeActive && minAmountOut !== undefined
			? (minAmountOut * BigInt(10000 - referral!.bps)) / 10000n
			: minAmountOut;

	const payload: Record<string, string | number> = {
		type: 'swap',
		version: '1.0.0',
		asset_in: assetIn,
		asset_out: assetOut,
		amount_in: amountIn.raw.toString(),
		min_amount_out: finalMinAmountOut !== undefined ? finalMinAmountOut.toString() : '0',
		recipient: destinationRecipient ?? caller
	};
	if (destinationChain) payload.destination_chain = destinationChain;
	if (feeActive) {
		payload.beneficiary = referral!.beneficiary;
		payload.ref_bps = referral!.bps;
	}

	const op = {
		net_id: config.network,
		caller,
		contract_id: config.dexRouterContractId,
		action: 'execute',
		payload: JSON.stringify(payload),
		rc_limit: destinationChain ? 10000 : 2000,
		intents: isNative
			? [
					{
						type: 'transfer.allow',
						args: {
							limit: amountIn.toDecimalString(),
							token: assetIn.toLowerCase()
						}
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

/** Convenience: decide whether a referral fee applies for this swap shape. */
export function referralQualifies(params: {
	assetOut: SwapAsset;
	destinationChain?: DestinationChain;
	inputUsd: number;
	referral: ReferralConfig | null | undefined;
}): boolean {
	const { assetOut, destinationChain, inputUsd, referral } = params;
	if (!referral) return false;
	if (!destinationChain) return false;
	if (assetOut === 'HIVE' || assetOut === 'HBD') return false;
	const threshold = referral.usdThreshold ?? 0;
	return Number.isFinite(inputUsd) && inputUsd >= threshold;
}
