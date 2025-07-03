import { GetStatusesStore } from '$houdini';
import { readonly, writable, type Writable } from 'svelte/store';

const checkingStores: { [tx_id: string]: Writable<string> } = {};

function updateStatuses() {
	const idsToFetch = Object.keys(checkingStores);
	new GetStatusesStore()
		.fetch({
			variables: {
				txIds: idsToFetch
			},
			policy: 'NetworkOnly'
		})
		.then((res) => {
			// console.log('FETCHED');
			const statuses = res.data?.findTransaction;
			if (!statuses) return;
			for (const { status, id } of statuses) {
				const store = checkingStores[id];
				if (!store) continue; // specific op succeeded
				// despite part of transaction being unconfirmed
				store.set(status);
				if (['CONFIRMED', 'FAILED'].includes(status)) {
					removeFromChecks(id);
				}
			}
		});
}

function removeFromChecks(tx_id: string) {
	delete checkingStores[tx_id];
	// make sure that checkingStores is empty before clearing interval
	// if there are any keys left then it will exit early
	if (Object.keys(checkingStores).length > 0) {
		return;
	}
	clearInterval(timeout);
	timeout = undefined;
}

let timeout: NodeJS.Timeout | undefined = undefined;

export const checkOpStatus = (tx_id: string, currStatus: string) => {
	// console.log('statusquery - checkOpStatus called:', tx_id, currStatus);
	if (checkingStores[tx_id]) {
		return checkingStores[tx_id];
	}
	const store = writable(currStatus, () => {
		// console.log('statusquery - Store subscribed, starting interval');
		if (timeout == undefined) {
			timeout = setInterval(updateStatuses, 1000);
		}
		return () => {
			removeFromChecks(tx_id);
		};
	});
	if (['CONFIRMED', 'FAILED'].includes(currStatus)) return store;

	// console.log('WRITABLE');
	checkingStores[tx_id] = store;
	// console.log('statusquery - Added to checkingStores:', tx_id, Object.keys(checkingStores));
	return readonly(store);
};
