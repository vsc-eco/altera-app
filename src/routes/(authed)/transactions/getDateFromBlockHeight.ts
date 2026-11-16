import moment from 'moment';
import { get, writable } from 'svelte/store';
import { BLOCK_SECONDS, blockHeightFromDate } from '$lib/calc';
const START_BLOCK = 88079516;
const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');

export const blockSync = writable({
	height: START_BLOCK,
	time: START_BLOCK_TIME
});

export function getDateFromBlockHeight(blockHeight: number) {
	const currentSync = get(blockSync);
	const offsetSeconds = (blockHeight - currentSync.height) * BLOCK_SECONDS;
	return offsetSeconds < 0
		? currentSync.time.clone().subtract(-offsetSeconds, 'seconds')
		: currentSync.time.clone().add(offsetSeconds, 'seconds');
}

export function getBlockHeightFromDate(date: Date | moment.Moment): number {
	const currentSync = get(blockSync);
	return blockHeightFromDate(
		moment(date).valueOf(),
		currentSync.height,
		currentSync.time.valueOf()
	);
}
