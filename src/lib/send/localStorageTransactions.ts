import type { UnkCoinAmount } from "$lib/currency/CoinAmount"
import { Coin } from "./sendOptions";
import { updateTxsFromLocalStorage, type TransactionInter } from "../../routes/(authed)/transactions/txStores";

type PendingTx = {
    data: {
        amount: UnkCoinAmount,
        asset: string,
        from: string,
        memo: string,
        to: string,
        type: string,
    }
    id: string,
    timestamp: Date,
    tx_id?: string,
}

function toTransactionInter(ptx: PendingTx): TransactionInter {
    return {
        isPending: true,
        anchr_height: 0,
        anchr_ts: ptx.timestamp.toISOString().slice(0, 19),
        status: "pending",
        id: ptx.id,
        anchr_opidx: 0,
        tx_id: ptx.tx_id ? ptx.tx_id : "UNK",
        first_seen: ptx.timestamp.toISOString(),
        ledger: null,
        data: { ...ptx.data, amount: ptx.data.amount.amount},
    }
}

export function addLocalTransaction(tx: PendingTx) {
    const txString = localStorage.getItem("transactions");
    let txList: TransactionInter[] = txString ? JSON.parse(txString) : [];
    txList.push(toTransactionInter(tx));
    localStorage.setItem("transactions", JSON.stringify(txList));
    updateTxsFromLocalStorage();
}

export function getLocalTransactions(): TransactionInter[] {
    const txString = localStorage.getItem("transactions");
    return txString ? JSON.parse(txString) : [];
}

export function removeLocalTransaction(id: string) {
    const txString = localStorage.getItem("transactions");
    const txList: TransactionInter[] = txString ? JSON.parse(txString) : null;
    if (!txList) {
        return Error("No items in local storage.");
    }
    const newTxList = txList.filter((element, _) => element.id !== id);
    localStorage.setItem("transactions", JSON.stringify(newTxList));
}