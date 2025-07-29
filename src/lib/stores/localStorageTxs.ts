import type { UnkCoinAmount } from '$lib/currency/CoinAmount';
import {
	updateTxsFromLocalStorage,
	type TransactionInter
} from './txStores';

export type PendingTx = {
	ops: {
		data: {
			amount: string;
			asset: string;
			from: string;
			to: string;
			type: string;
			memo?: string;
		};
		type: string;
		index: number;
	}[];
	id: string;
	timestamp: Date;
	type: string;
};

function toPendingTransactionInter(ptx: PendingTx): TransactionInter {
	``;
	return {
		...ptx,
		isPending: true,
		anchr_height: 0,
		anchr_ts: ptx.timestamp.toISOString().slice(0, 19),
		status: 'PENDING',
		first_seen: ptx.timestamp.toISOString().slice(0, 19),
		ledger: null,
		ops: ptx.ops.map((tx) => ({ ...tx, index: 0 }))
	};
}

export function addLocalTransaction(tx: PendingTx) {
	const txString = localStorage.getItem('transactions');
	let txList: TransactionInter[] = txString ? JSON.parse(txString) : [];
	txList.push(toPendingTransactionInter(tx));
	localStorage.setItem('transactions', JSON.stringify(txList));
	updateTxsFromLocalStorage(tx.ops[0].data.from);
}

export function getLocalTransactions(): TransactionInter[] {
	const txString = localStorage.getItem('transactions');
	return txString ? JSON.parse(txString) : [];
}

export function removeLocalTransaction(id: string) {
	const txString = localStorage.getItem('transactions');
	const txList: TransactionInter[] = txString ? JSON.parse(txString) : null;
	if (!txList) {
		return Error('No items in local storage.');
	}
	const newTxList = txList.filter((element, _) => element.id !== id);
	localStorage.setItem('transactions', JSON.stringify(newTxList));
}
