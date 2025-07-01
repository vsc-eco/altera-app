import type { TransferTransaction, DepositTransaction, WithdrawTransaction } from '../eth/client';
import { Coin, Network } from '$lib/send/sendOptions';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';

export function getEVMOpType(
	fromNetwork: Network,
	toNetwork: Network,
	from: string,
	to: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd>
): TransferTransaction | DepositTransaction | WithdrawTransaction {
	let payload = {
		from: from,
		to: to,
		amount: amount.toPrettyAmountString(),
		asset: amount.coin.unit.toLowerCase(),
		netId: 'vsc-mainnet',
	}
	if (fromNetwork == Network.vsc && toNetwork == Network.vsc) {
		return {
			op: 'transfer',
			payload: payload
		}
	}
	if (fromNetwork == Network.hiveMainnet && toNetwork == Network.vsc) {
		return {
			op: 'deposit',
			payload: payload
		}
	}
	if (fromNetwork == Network.vsc && toNetwork == Network.hiveMainnet) {
		return {
			op: 'withdraw',
			payload: payload
		}
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
};