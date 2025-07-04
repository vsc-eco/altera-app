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
		asset: amount.coin.unit.toLowerCase()
	};
	if (fromNetwork.value == Network.vsc.value && toNetwork.value == Network.vsc.value) {
		return {
			op: 'transfer',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.hiveMainnet.value && toNetwork.value == Network.vsc.value) {
		return {
			op: 'deposit',
			payload: payload
		};
	}
	if (fromNetwork.value == Network.vsc.value && toNetwork.value == Network.hiveMainnet.value) {
		return {
			op: 'withdraw',
			payload: payload
		};
	}
	throw new Error(
		`VSC does not currently support going from ${fromNetwork.label} to ${toNetwork.label}`
	);
}
