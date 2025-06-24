import moment from 'moment';
const START_BLOCK = 88079516;
const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');
export function getDateFromBlockHeight(blockHeight: number) {
	const date =
		(blockHeight - START_BLOCK) * 3 < 0
			? START_BLOCK_TIME.clone().subtract(-(blockHeight - START_BLOCK) * 3, 'seconds')
			: START_BLOCK_TIME.clone().add((blockHeight - START_BLOCK) * 3, 'seconds');
	return date;
}

export function getBlockHeightFromDate(date: Date | moment.Moment): number {
	const targetDate = moment(date);
	const diffInSeconds = targetDate.diff(START_BLOCK_TIME, 'seconds');
	const blockHeight = START_BLOCK + Math.floor(diffInSeconds / 3);
	return blockHeight;
}
