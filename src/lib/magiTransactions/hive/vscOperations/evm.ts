import type { CustomJsonOperation } from '@hiveio/dhive';
import { Coin } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount } from '$lib/currency/CoinAmount';
import { vscNetworkId } from '../../../../client';
import { EVM_BRIDGE_CONTRACT_ID, USDC_TOKEN_ADDRESS } from '$lib/constants';
import { toChainUnits } from '$lib/currency/chainAmount';

// ETH and USDC on the EVM bridge: the counterparts of bitcoin.ts. One contract
// holds both assets, so every call names its asset.

type callContractOp = {
	net_id: string;
	caller: string;
	contract_id: string;
	action: string;
	payload: object;
	rc_limit: number;
};

/** The bridge call that pays `amount` out to an Ethereum address. */
export function getEvmUnmapCall(
	toEthAddress: string,
	amount: CoinAmount<Coin>,
	deductFee?: boolean
): { action: 'unmapETH' | 'unmapERC20'; payload: Record<string, unknown> } {
	const base = {
		amount: toChainUnits(amount),
		to: toEthAddress,
		...(deductFee ? { deduct_fee: true } : {})
	};
	if (amount.coin.value === Coin.eth.value) return { action: 'unmapETH', payload: base };
	if (amount.coin.value === Coin.usdc.value) {
		return {
			action: 'unmapERC20',
			payload: { ...base, asset: Coin.usdc.value, token_address: USDC_TOKEN_ADDRESS }
		};
	}
	throw new Error(`${amount.coin.label} is not held by the EVM bridge`);
}

/** Moves ETH or USDC between Magi accounts on the bridge's ledger. */
export function getEvmTransferOp(
	from: string,
	toDid: string,
	amount: CoinAmount<Coin>,
	_memo?: URLSearchParams,
	callerDid?: string
): CustomJsonOperation {
	const jsonOutput: callContractOp = {
		net_id: vscNetworkId,
		caller: callerDid ?? `hive:${from}`,
		contract_id: EVM_BRIDGE_CONTRACT_ID,
		action: 'transfer',
		payload: { amount: toChainUnits(amount), to: toDid, asset: amount.coin.value },
		rc_limit: 1000
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
 * @param rcLimit Size it with `estimateCallRc` (rcSizing.ts), as for the BTC unmap:
 *                a withdrawal books a nonce and its gas, so no fixed value is safe.
 */
export function getEvmUnmapOp(
	from: string,
	callerDid: string,
	toEthAddress: string,
	amount: CoinAmount<Coin>,
	rcLimit: number,
	deductFee?: boolean
): CustomJsonOperation {
	const { action, payload } = getEvmUnmapCall(toEthAddress, amount, deductFee);
	const jsonOutput: callContractOp = {
		net_id: vscNetworkId,
		caller: callerDid,
		contract_id: EVM_BRIDGE_CONTRACT_ID,
		action,
		payload,
		rc_limit: rcLimit
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
