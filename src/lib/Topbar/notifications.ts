import { writable } from 'svelte/store';
import { type TransactionInter } from '$lib/stores/txStores';

interface Notification extends TransactionInter {
	read: boolean;
}

export const notifications = writable<Notification[]>([]);

export function addNotification(tx: Notification) {
	notifications.update((current) => {
		return [tx, ...current];
	});
	const txString = localStorage.getItem('notifications');
	let txList: Notification[] = txString ? JSON.parse(txString) : [];
	txList.push(tx);
	localStorage.setItem('notifications', JSON.stringify(txList));
}

export function getLocalNotifications(): Notification[] {
	const txString = localStorage.getItem('notifications');
	return txString ? JSON.parse(txString) : [];
}

export function setLocalNotifications(notifications: Notification[]) {
	localStorage.setItem('notifications', JSON.stringify(notifications));
}

export function removeNotification(id: string) {
	notifications.update((current) => {
		return current.filter((item) => item.id !== id);
	});
	const txString = localStorage.getItem('notifications');
	const txList: Notification[] = txString ? JSON.parse(txString) : null;
	if (!txList) {
		return Error('No items in local storage.');
	}
	const newTxList = txList.filter((element, _) => element.id !== id);
	localStorage.setItem('notifications', JSON.stringify(newTxList));
}
