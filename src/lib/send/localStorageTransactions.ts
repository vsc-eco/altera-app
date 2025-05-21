import type { UnkCoinAmount } from "$lib/currency/CoinAmount"
import { Coin } from "./sendOptions";
import type { GetTransactions$result } from '$houdini';

export type PendingTx = {
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
}

export function addLocalTransaction(tx: PendingTx) {
    const txString = localStorage.getItem("transactions");
    if (txString) {
        var txList: PendingTx[] = JSON.parse(txString);
    } else {
        var txList: PendingTx[] = [];
    }
    txList.push(tx);
    localStorage.setItem("transactions", JSON.stringify(txList));
}

export function getLocalTransactions(): PendingTx[] {
    const txString = localStorage.getItem("transactions");
    return JSON.parse(txString? txString : "")
}

export function removeLocalTransaction(tx: PendingTx) {
    const txString = localStorage.getItem("transactions");
    if (txString) {
        var txList: PendingTx[] = JSON.parse(txString);
    } else {
        return Error("No items in local storage.")
    }
    const newTxList = txList.filter((element, _) => element !== tx);
    localStorage.setItem("transactions", JSON.stringify(newTxList));
}