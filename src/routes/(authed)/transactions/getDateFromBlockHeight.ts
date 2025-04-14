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
