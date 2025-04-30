import { GetStatusesStore } from '$houdini';
import { readonly, writable, type Writable } from 'svelte/store';

const statusStore = new GetStatusesStore();

const checkingStores: { [tx_id: string]: { [op_id: number]: Writable<string> } } = {};

function updateStatuses() {
	const idsToFetch = Object.keys(checkingStores);
	statusStore
		.fetch({
			variables: {
				txIds: idsToFetch
			},
			policy: 'NetworkOnly'
		})
		.then((res) => {
			console.log('FETCHED');
			const statuses = res.data?.findTransaction;
			if (!statuses) return;
			for (const { status, tx_id, anchr_opidx: op_id } of statuses) {
				const store = checkingStores[tx_id][op_id];
				store.set(status);
				if (['CONFIRMED', 'FAILED'].includes(status)) {
					removeFromChecks(tx_id, op_id);
				}
			}
		});
}

function removeFromChecks(tx_id: string, op_id: number) {
	delete checkingStores[tx_id]?.[op_id];
	// make sure that checkingStores is empty before deleting the empty map
	for (const _store in checkingStores[tx_id]) {
		return;
	}
	delete checkingStores[tx_id];
	// make sure that checkingStores is empty before clearing interval
	// if there are any keys left then it will exit early
	for (const _opList in checkingStores) {
		return;
	}
	clearInterval(timeout);
	timeout = undefined;
}

let timeout: NodeJS.Timeout | undefined = undefined;

export const checkOpStatus = (tx_id: string, op_id: number, currStatus: string) => {
	if (checkingStores[tx_id]?.[op_id] != undefined) {
		return checkingStores[tx_id][op_id];
	}
	let out = writable(currStatus, () => {
		if (timeout == undefined) {
			timeout = setInterval(updateStatuses, 1000);
		}
		return () => {
			removeFromChecks(tx_id, op_id);
		};
	});
	if (['CONFIRMED', 'FAILED'].includes(currStatus)) return out;
	let store = checkingStores[tx_id];
	if (!store) {
		checkingStores[tx_id] = {};
		store = checkingStores[tx_id];
	}
	console.log('WRITABLE');
	store[op_id] = out;
	return readonly(out);
};
