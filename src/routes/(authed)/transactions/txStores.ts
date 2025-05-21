import { writable, derived } from 'svelte/store';
import type { GetTransactions$result } from '$houdini';
import { getLocalTransactions } from '$lib/send/localStorageTransactions';
import { type PendingTx } from '$lib/send/localStorageTransactions';

type VscTransaction = NonNullable<GetTransactions$result['findTransaction']>[number];

export const vscTxsStore = writable<VscTransaction[]>([]);
export const localTxsStore = writable<PendingTx[]>([]);

type Transaction = VscTransaction | PendingTx;

function isVscTransaction(tx: Transaction): tx is VscTransaction {
  return 'first_seen' in tx;
}

// Create a derived store that combines and sorts transactions
export const allTransactionsStore = derived(
  [vscTxsStore, localTxsStore],
  ([$vscTxsStore, $localTxsStore]) => {
    // Combine both sources
    const combined = [...$vscTxsStore, ...$localTxsStore];

    const uniqueTransactions = Object.values(
      combined.reduce(
        (prev, curr) => {
          // Use the transaction ID as the key to ensure uniqueness
          const id = isVscTransaction(curr) ? curr.id : `pending-${curr.data.from}-${curr.data.to}-${curr.data.amount}`;
          prev[id] = curr;
          return prev;
        },
        {} as { [id: string]: Transaction }
      )
    );
    
    // Sort by timestamp (descending)
    return uniqueTransactions.sort((a, b) => {
        const timeA = isVscTransaction(a) ? new Date(a.first_seen).getTime() : a.timestamp.getTime();
        const timeB = isVscTransaction(a) ? new Date(a.first_seen).getTime() : a.timestamp.getTime();
        return timeB - timeA;
    });
  }
);

export function fetchFromLocalStorage() {
    const txs = getLocalTransactions();
    
}