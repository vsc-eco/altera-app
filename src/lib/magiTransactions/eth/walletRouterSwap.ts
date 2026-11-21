/**
 * A DEX router swap signed by a wallet account (EVM or Bitcoin wallet), from
 * its Magi balance. The QuickSwap card and the /swap page build it here, so
 * both send the same instruction and the same ops.
 *
 * The /swap page used to send these swaps through getEVMOpType, which signs a
 * transfer, withdraw or unmap of the OUTPUT asset: no swap ran, and whatever
 * the account already held of the output asset went out instead.
 */

import { getDidFromUsername } from '$lib/getAccountName';
import { BTC_MAPPING_CONTRACT_ID, EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { toChainUnits } from '$lib/currency/chainAmount';
import { isEvmBridgeCoin } from '../evmBridge';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import {
	ALTERA_FEE_ACTIVE,
	ALTERA_FEE_BENEFICIARY,
	ALTERA_FEE_BPS,
	hasQuoteMinimum,
	qualifiesForAlteraFee,
	SWAP_CONTRACT_ID,
	SWAP_NEEDS_QUOTE_MESSAGE
} from '../hive/vscOperations/swap';
import {
	btcPayoutShortfallMessage,
	EVM_PAYOUT_SWAP_MIN_RC,
	evmPayoutShortfallMessage,
	fetchAccountRc,
	btcPayoutMinRcForInput,
	fetchBtcPayoutSwapMinRc,
	rcShortfallMessage
} from '../hive/vscOperations/rcSizing';
import type { CallContractTransaction } from './client';
import { buildEvmSwapOps, evmSwapRcLimit, EVM_APPROVE_RC_LIMIT } from './evmSwap';

export type WalletRouterSwap = {
	/** The signing account's DID (did:pkh:eip155:... or did:pkh:bip122:...). */
	caller: string;
	fromCoin: Coin;
	toCoin: Coin;
	/** The input, in the input asset. */
	amount: CoinAmount<Coin>;
	/** The quote's smallest accepted output before any Altera fee, smallest units. */
	minAmountOut?: string;
	/** 'HIVE' or 'BTC' to settle the output there; absent keeps it on Magi. */
	destinationChain?: string;
	/** The receiver on destinationChain. A swap kept on Magi pays the caller. */
	recipient?: string;
	/**
	 * The contract that holds a mapped input (BTC or a custom token); the router
	 * pulls it with transferFrom, so it gets an allowance. Defaults to the BTC
	 * mapping contract. Unused for HIVE/HBD.
	 */
	mappedContractId?: string;
};

export type WalletRouterSwapOps =
	| { ok: true; ops: CallContractTransaction[] }
	| { ok: false; error: string };

/** The router instruction, as the QuickSwap card has always sent it. */
export function walletRouterSwapInstruction(
	swap: WalletRouterSwap,
	feeQualifies: boolean
): Record<string, string | number> {
	const storeMin = swap.minAmountOut || undefined;
	// The contract checks min_amount_out after the Altera fee comes off, so
	// scale the quote's pre-fee minimum down by the same bps.
	const min =
		feeQualifies && storeMin
			? ((BigInt(storeMin) * BigInt(10000 - ALTERA_FEE_BPS)) / 10000n).toString()
			: (storeMin ?? '0');
	const instruction: Record<string, string | number> = {
		type: 'swap',
		version: '1.0.0',
		asset_in: swap.fromCoin.value.toUpperCase(),
		asset_out: swap.toCoin.value.toUpperCase(),
		amount_in: toChainUnits(swap.amount),
		min_amount_out: min,
		recipient: swap.recipient || (swap.destinationChain ? '' : swap.caller)
	};
	if (swap.destinationChain) instruction.destination_chain = swap.destinationChain;
	if (feeQualifies) {
		instruction.beneficiary = ALTERA_FEE_BENEFICIARY;
		instruction.ref_bps = ALTERA_FEE_BPS;
	}
	return instruction;
}

/**
 * The ops to sign, sized to the RC the account holds. A wallet account has no
 * free RC (its RC is its HBD), so a swap it cannot pay for is refused here,
 * before anything is signed.
 */
export function buildWalletRouterSwapOps(
	swap: WalletRouterSwap,
	ctx: { feeQualifies: boolean; availableRc: number; btcPayoutMinRc?: number }
): WalletRouterSwapOps {
	if (swap.destinationChain && !swap.recipient) {
		return { ok: false, error: 'Enter a receiver address for the target chain' };
	}
	if (!hasQuoteMinimum(swap.minAmountOut)) {
		return { ok: false, error: SWAP_NEEDS_QUOTE_MESSAGE };
	}
	const isNativeIn =
		swap.fromCoin.value === Coin.hive.value || swap.fromCoin.value === Coin.hbd.value;
	// A payout on Bitcoin or Ethereum withdraws through a bridge in the same
	// call: it gets the account's RC, with that payout's minimum.
	const ethPayout = swap.destinationChain === 'ETH';
	const sizing = evmSwapRcLimit(
		ctx.availableRc,
		swap.fromCoin.value === Coin.hbd.value ? swap.amount.amount : 0,
		isNativeIn ? 0 : EVM_APPROVE_RC_LIMIT,
		swap.destinationChain === 'BTC' || ethPayout,
		ethPayout ? EVM_PAYOUT_SWAP_MIN_RC : ctx.btcPayoutMinRc
	);
	if (!sizing.ok) {
		return {
			ok: false,
			error:
				swap.destinationChain === 'BTC'
					? btcPayoutShortfallMessage(sizing)
					: ethPayout
						? evmPayoutShortfallMessage(sizing)
						: rcShortfallMessage(sizing, 'swap')
		};
	}
	const ops = buildEvmSwapOps({
		caller: swap.caller,
		routerId: SWAP_CONTRACT_ID,
		instruction: JSON.stringify(walletRouterSwapInstruction(swap, ctx.feeQualifies)),
		rcLimit: sizing.rcLimit,
		input: isNativeIn
			? { kind: 'native', token: swap.fromCoin.value, limit: swap.amount.toAmountString(true) }
			: isEvmBridgeCoin(swap.fromCoin)
				? {
						kind: 'mapped',
						mappingContractId: EVM_BRIDGE_CONTRACT_ID,
						rawAmount: toChainUnits(swap.amount),
						asset: swap.fromCoin.value
					}
				: {
						kind: 'mapped',
						mappingContractId: swap.mappedContractId ?? BTC_MAPPING_CONTRACT_ID,
						rawAmount: toChainUnits(swap.amount)
					}
	});
	return { ok: true, ops };
}

/**
 * buildWalletRouterSwapOps with the Altera fee check and the account's RC
 * looked up. `fallbackRc` is used when the node cannot be asked.
 */
export async function prepareWalletRouterSwap(
	swap: WalletRouterSwap,
	fallbackRc?: number
): Promise<WalletRouterSwapOps> {
	const feeQualifies =
		ALTERA_FEE_ACTIVE &&
		(await qualifiesForAlteraFee(swap.amount, swap.toCoin, swap.destinationChain || undefined));
	const availableRc = (await fetchAccountRc(swap.caller)) ?? fallbackRc ?? 0;
	// Only a BTC payout has a minimum that depends on the chain's version.
	const btcPayoutMinRc =
		swap.destinationChain === 'BTC'
			? btcPayoutMinRcForInput(await fetchBtcPayoutSwapMinRc(), isEvmBridgeCoin(swap.fromCoin))
			: undefined;
	return buildWalletRouterSwapOps(swap, { feeQualifies, availableRc, btcPayoutMinRc });
}

/**
 * The swap a wallet account asked for on the /swap page, or null when the send
 * is not a swap (the coins match, or the input is not on Magi). Mirrors the
 * Hive wallet path in send(): a swap kept on Magi pays the caller, a payout
 * on Hive or Bitcoin pays the entered receiver.
 */
export function walletSwapFromMagi(args: {
	caller: string;
	fromCoin: Coin;
	toCoin: Coin;
	fromNetwork: string;
	toNetwork: string;
	/** The input amount, in the input asset. */
	fromAmount: string;
	toUsername?: string;
	minAmountOut?: string;
	/** Every coin the router can swap here (HIVE, HBD, BTC and custom tokens). */
	swapCoins: string[];
	/** The input's own contract when it is a custom token. */
	customTokenContractId?: string;
}): WalletRouterSwap | { error: string } | null {
	if (args.fromNetwork !== Network.magi.value) return null;
	if (args.fromCoin.value === args.toCoin.value) return null;
	if (
		!args.swapCoins.includes(args.fromCoin.value) ||
		!args.swapCoins.includes(args.toCoin.value)
	) {
		return { error: `${args.fromCoin.label} cannot be swapped for ${args.toCoin.label} here.` };
	}
	let destinationChain: string | undefined;
	if (args.toNetwork === Network.hiveMainnet.value) destinationChain = 'HIVE';
	else if (args.toNetwork === Network.btcMainnet.value) destinationChain = 'BTC';
	else if (args.toNetwork === Network.ethMainnet.value && isEvmBridgeCoin(args.toCoin))
		destinationChain = 'ETH';
	else if (args.toNetwork !== Network.magi.value) {
		return { error: 'This swap cannot pay out on that network.' };
	}
	let recipient: string | undefined;
	if (destinationChain) {
		const raw = (args.toUsername ?? '').trim();
		recipient =
			destinationChain === 'HIVE' && raw && !raw.startsWith('hive:')
				? `hive:${raw.replace(/^@/, '')}`
				: raw;
		if (!recipient) return { error: 'Missing recipient address for mainnet settlement' };
	} else {
		// Kept on Magi pays `toUsername` too: "Send to address" with Magi used
		// to pay the swapper and ignore the address (M1, 11-17 review; facelift
		// 7d42ac8). Blank means "pay me". getDidFromUsername, not a hive:
		// prefix: a wallet login's own account is an address (did:pkh form).
		const raw = (args.toUsername ?? '').trim();
		if (raw) recipient = getDidFromUsername(raw) || undefined;
	}
	if (!/^[0-9]*\.?[0-9]+$/.test(args.fromAmount) || Number(args.fromAmount) <= 0) {
		return { error: 'Enter an amount to swap.' };
	}
	return {
		caller: args.caller,
		fromCoin: args.fromCoin,
		toCoin: args.toCoin,
		amount: new CoinAmount(args.fromAmount, args.fromCoin),
		minAmountOut: args.minAmountOut,
		destinationChain,
		recipient,
		mappedContractId: args.customTokenContractId
	};
}
