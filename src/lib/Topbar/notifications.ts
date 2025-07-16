import { writable } from 'svelte/store';
import { type TransactionInter } from '$lib/stores/txStores';

export const notifications = writable<TransactionInter[]>([]);

export function addNotification(tx: TransactionInter) {
	notifications.update((current) => {
		return [tx, ...current];
	});
	const txString = localStorage.getItem('notifications');
	let txList: TransactionInter[] = txString ? JSON.parse(txString) : [];
	txList.push(tx);
	localStorage.setItem('notifications', JSON.stringify(txList));
}

export function getLocalNotifications(): TransactionInter[] {
	const txString = localStorage.getItem('notifications');
	return txString ? JSON.parse(txString) : [];
}

export function removeNotification(id: string) {
	notifications.update((current) => {
		return current.filter((item) => item.id !== id);
	});
	const txString = localStorage.getItem('notifications');
	const txList: TransactionInter[] = txString ? JSON.parse(txString) : null;
	if (!txList) {
		return Error('No items in local storage.');
	}
	const newTxList = txList.filter((element, _) => element.id !== id);
	localStorage.setItem('notifications', JSON.stringify(newTxList));
}
