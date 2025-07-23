import moment from 'moment';
import { get, writable } from 'svelte/store';
const START_BLOCK = 88079516;
const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');

export const blockSync = writable({
	height: START_BLOCK,
	time: START_BLOCK_TIME
});

export function getDateFromBlockHeight(blockHeight: number) {
	const currentSync = get(blockSync);
	const date =
		(blockHeight - currentSync.height) * 3 < 0
			? currentSync.time.clone().subtract(-(blockHeight - currentSync.height) * 3, 'seconds')
			: currentSync.time.clone().add((blockHeight - currentSync.height) * 3, 'seconds');
	return date;
}

export function getBlockHeightFromDate(date: Date | moment.Moment): number {
	const currentSync = get(blockSync);
	const targetDate = moment(date);
	const diffInSeconds = targetDate.diff(currentSync.time, 'seconds');
	const blockHeight = currentSync.height + Math.floor(diffInSeconds / 3);
	return blockHeight;
}
