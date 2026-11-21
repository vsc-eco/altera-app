/**
 * What arrives on Ethereum from a swap paid out there.
 *
 * The router withdraws the swap's output less the bridge's proving fee, and the
 * bridge takes the Ethereum gas out of what it sends. The bridge reports the gas
 * a payout pays right now in its getInfo ("payout_gas_fee", account-mapping
 * PAYOUT-1: the expected cost, nothing refunded later), read here with a dry
 * run. A bridge from before PAYOUT-1 does not report it: it takes the most the
 * transaction can burn (for USDC at most half the minimum withdrawal) and
 * returns the unused part to the Magi account after the payout settles.
 */
import { SimulateContractCallsStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';
import { ETH_CHAIN_ID, EVM_BRIDGE_CONTRACT_ID } from '$lib/constants';
import { fetchActiveVaultAddress } from './bridgeDeposit';

export type EvmPayoutGas =
	/** The gas the bridge takes now, in the asset's smallest units. */
	| { status: 'priced'; fee: number }
	/** A bridge from before PAYOUT-1: worst case now, unused part refunded on Magi later. */
	| { status: 'legacy' }
	/** The bridge cannot price a payout now (no fresh Ethereum header): it waits and is sent later. */
	| { status: 'unavailable' }
	/** Not read (the node did not answer). */
	| { status: 'unknown' };

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: EvmPayoutGas }>();

/** Parse the bridge's getInfo answer (exported for tests). */
export function parsePayoutGas(ret: string | null | undefined): EvmPayoutGas {
	if (!ret) return { status: 'unknown' };
	try {
		const info = JSON.parse(ret) as { payout_gas_fee?: string };
		if (info.payout_gas_fee === undefined) return { status: 'legacy' };
		if (info.payout_gas_fee === '' || !/^\d+$/.test(info.payout_gas_fee)) {
			return { status: 'unavailable' };
		}
		return { status: 'priced', fee: Number(info.payout_gas_fee) };
	} catch {
		return { status: 'unknown' };
	}
}

/**
 * The gas a payout of `asset` ('eth' or 'usdc') pays now, cached for 30 s. An
 * ETH payout is priced at `gasLimit`, the gas_limit it will carry (its
 * recipient's estimate, ethPayoutGasLimit); without one, at the bridge's
 * default, which is what a payout without one uses.
 */
export async function fetchEvmPayoutGas(
	callerDid: string,
	asset: string,
	gasLimit: number | null = null
): Promise<EvmPayoutGas> {
	const key = `${asset}:${gasLimit ?? ''}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
	let value: EvmPayoutGas = { status: 'unknown' };
	try {
		const res = await queryOnce(new SimulateContractCallsStore(), {
			variables: {
				account: callerDid,
				input: {
					tx_id: `altera-payout-fee-${Date.now()}`,
					required_auths: [callerDid],
					calls: [
						{
							contract_id: EVM_BRIDGE_CONTRACT_ID,
							action: 'getInfo',
							payload: JSON.stringify(
								gasLimit
									? { symbol: asset, fees: true, gas_limit: gasLimit }
									: { symbol: asset, fees: true }
							),
							rc_limit: 5000
						}
					]
				}
			},
			policy: 'NetworkOnly'
		});
		const sim = res.data?.simulateContractCalls?.[0];
		if (sim?.success) value = parsePayoutGas(sim.ret);
	} catch (err) {
		console.error('getInfo dry run failed', err);
	}
	if (value.status !== 'unknown') cache.set(key, { at: Date.now(), value });
	return value;
}

/**
 * The least that arrives, from the swap's minimum output (smallest units):
 * that less the proving fee and, when the bridge reports it, the gas. `heavy`
 * when the gas is more than a tenth of what is sent.
 */
export function payoutArrival(
	minOut: number,
	proofFee: number,
	gas: EvmPayoutGas
): { sent: number; gas: number | null; arrives: number | null; heavy: boolean } {
	const sent = Math.max(minOut - proofFee, 0);
	if (gas.status !== 'priced') return { sent, gas: null, arrives: null, heavy: false };
	const arrives = Math.max(sent - gas.fee, 0);
	return { sent, gas: gas.fee, arrives, heavy: sent > 0 && gas.fee * 10 > sent };
}

/** A plain ETH transfer's gas: the least an ETH payout's limit can be. */
export const ETH_TRANSFER_GAS = 21_000;
/**
 * The highest gas_limit the bridge takes on a payout (account-mapping
 * constants.MaxPayoutGasLimit); one above it is refused and the swap fails.
 */
export const MAX_ETH_PAYOUT_GAS = 300_000;

/**
 * An ETH payout's gas limit from an estimate: the estimate plus 20%, at least a
 * plain transfer, at most the bridge's limit (exported for tests).
 */
export function payoutGasLimitFromEstimate(estimate: bigint): number {
	const withMargin = Math.ceil(Number(estimate) * 1.2);
	return Math.min(Math.max(withMargin, ETH_TRANSFER_GAS), MAX_ETH_PAYOUT_GAS);
}

/**
 * The gas limit for an ETH payout to `to`: what a transfer of `valueWei` from
 * the bridge's vault to that address needs on Ethereum now, plus 20% (owner
 * 11-21: "raise above median by something like 20%"). The bridge signs and
 * charges exactly those units, so an address that needs more (a contract
 * wallet, a new-account cost after Glamsterdam) is covered instead of the
 * payout reverting, and a plain address pays for ~25,000 gas, not the bridge's
 * default. null when it cannot be estimated: the bridge then uses its default.
 */
export async function ethPayoutGasLimit(
	callerDid: string,
	to: string,
	valueWei: bigint
): Promise<number | null> {
	const vault = await fetchActiveVaultAddress(callerDid);
	if (!vault) return null;
	try {
		// The wagmi config (and its public Ethereum RPC) is created on demand: a
		// Hive login has none until this (as connectedWalletBalances does).
		const { initModal, wagmiConfig } = await import('$lib/auth/reown');
		initModal();
		if (!wagmiConfig) return null;
		const { estimateGas } = await import('@wagmi/core');
		const gas = await estimateGas(wagmiConfig, {
			account: vault as `0x${string}`,
			to: to as `0x${string}`,
			value: valueWei,
			chainId: ETH_CHAIN_ID
		});
		return payoutGasLimitFromEstimate(gas);
	} catch (err) {
		console.error('ETH payout gas estimate failed', err);
		return null;
	}
}
