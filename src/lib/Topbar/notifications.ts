import { get, writable } from 'svelte/store';

type ToNotification = {
	to: string;
	type: string;
	timestamp: string;
	read: boolean;
	status: string;
};

type FromNotification = {
	from: string;
	type: string;
	timestamp: string;
	read: boolean;
	status: string;
};

export type Notification = ToNotification | FromNotification;

export const notifications = writable<Map<string, Notification>>(new Map());
export const notificationUpdateIndicator = writable<string>('');

function indicateUpdate() {
	let allIds = '';
	for (const id of get(notifications).keys()) {
		allIds += id;
	}
	notificationUpdateIndicator.set(allIds);
}

export function addNotification(id: string, tx: Notification) {
	const ntfs = get(notifications);
	if (ntfs.has(id)) return;
	get(notifications).set(id, tx);
	setLocalNotifications(get(notifications));
}

export function getLocalNotifications(): Map<string, Notification> {
	const txString = localStorage.getItem('notifications');
	if (!txString) return new Map();
	const kvArray: [string, Notification][] = JSON.parse(txString);
	return new Map(kvArray);
}

export function setLocalNotifications(notifications: Map<string, Notification>) {
	localStorage.setItem('notifications', JSON.stringify(Array.from(notifications.entries())));
	indicateUpdate();
}

export function removeNotification(id: string) {
	get(notifications).delete(id);
	setLocalNotifications(get(notifications));
}
