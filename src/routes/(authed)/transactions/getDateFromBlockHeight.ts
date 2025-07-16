import moment from 'moment';
import { allTransactionsStore, getTimestamp } from './txStores';
import { get } from 'svelte/store';
import { GetTransactionsStore } from '$houdini';
const START_BLOCK = 88079516;
const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');

const updateSyncValues = (): Promise<[number, moment.Moment]> => {
	return new Promise<[number, moment.Moment]>((resolve) => {
		let attempts = 0;
		const maxAttempts = 5;
		const checkInterval = 1000; // 1 second

		const checkTransactions = () => {
			const txs = get(allTransactionsStore);

			if (txs.length > 0) {
				const startBlock = txs[0].anchr_height;
				const startTime = moment(getTimestamp(txs[0]));
				resolve([startBlock, startTime]);
				return;
			}

			attempts++;

			if (attempts < maxAttempts) {
				setTimeout(checkTransactions, checkInterval);
			} else {
				resolve([START_BLOCK, START_BLOCK_TIME]);
			}
		};

		checkTransactions();
	});
};

export async function getDateFromBlockHeight(blockHeight: number, wait = false) {
	const txs = get(allTransactionsStore);
	let startBlock = START_BLOCK;
	let startTime = START_BLOCK_TIME;
	if (wait && txs.length === 0) {
		[startBlock, startTime] = await updateSyncValues();
	} else {
		// tries once even if wait isn't specified
		if (txs.length > 0) {
			startBlock = txs[0].anchr_height;
			startTime = moment(getTimestamp(txs[0]));
		}
	}
	const date =
		(blockHeight - START_BLOCK) * 3 < 0
			? START_BLOCK_TIME.clone().subtract(-(blockHeight - START_BLOCK) * 3, 'seconds')
			: START_BLOCK_TIME.clone().add((blockHeight - START_BLOCK) * 3, 'seconds');
	return date;
}

export async function getBlockHeightFromDate(
	date: Date | moment.Moment,
	wait = false
): Promise<number> {
	const txs = get(allTransactionsStore);
	let startBlock = START_BLOCK;
	let startTime = START_BLOCK_TIME;
	if (wait && txs.length === 0) {
		[startBlock, startTime] = await updateSyncValues();
	} else {
		// tries once even if wait isn't specified
		if (txs.length > 0) {
			startBlock = txs[0].anchr_height;
			startTime = moment(getTimestamp(txs[0]));
		}
	}
	const targetDate = moment(date);
	const diffInSeconds = targetDate.diff(startTime, 'seconds');
	const blockHeight = startBlock + Math.floor(diffInSeconds / 3);
	return blockHeight;
}
