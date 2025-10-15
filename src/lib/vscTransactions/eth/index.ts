import type {
	TransferTransaction,
	DepositTransaction,
	WithdrawTransaction,
	CallContractTransaction
} from '../eth/client';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
import { CoinAmount, type UnkCoinAmount } from '$lib/currency/CoinAmount';
import { MAPPINGCONTRACTID } from '$lib/stores/currentBalance';
import type { TransferInput, UnmapInput } from '../bitcoin/bitcoinContractCalls';

export function getEVMOpType(
	fromNetwork: Network,
	toNetwork: Network,
	fromDid: string,
	toDid: string,
	amount: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>
): TransferTransaction | DepositTransaction | WithdrawTransaction | CallContractTransaction {
	if (amount.coin.value === Coin.btc.value) {
		if (toNetwork.value === Network.vsc.value) {
			const payload: TransferInput = {
				amount: amount.amount,
				recipient_vsc_address: toDid
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: MAPPINGCONTRACTID,
					action: 'transfer',
					payload: JSON.stringify(payload),
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		} else if (toNetwork.value === Network.btcMainnet.value) {
			const payload: UnmapInput = {
				amount: amount.amount,
				recipient_btc_address: toDid
			};

			const tx: CallContractTransaction = {
				op: 'call',
				payload: {
					contract_id: MAPPINGCONTRACTID,
					action: 'unmap',
					payload: JSON.stringify(payload),
					rc_limit: 10000,
					intents: [],
					caller: fromDid
				}
			};

			return tx;
		}
	}
	let payload = {
		from: fromDid,
		to: toDid,
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
