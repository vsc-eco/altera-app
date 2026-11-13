import moment from 'moment';
import type { DateRange } from './Date.svelte';

/** The presets every balance chart offers, newest-first as the dropdown shows
 *  them. Built on call so "last 7 days" is relative to now, not to module load. */
export function buildDateRanges(): DateRange[] {
	return [
		{ label: 'Last 7 Days', start: moment().subtract(7, 'days').toDate(), end: moment().toDate() },
		{
			label: 'Last 30 Days',
			start: moment().subtract(30, 'days').toDate(),
			end: moment().toDate()
		},
		{
			label: 'Last 90 Days',
			start: moment().subtract(90, 'days').toDate(),
			end: moment().toDate()
		},
		{
			label: 'Last 365 Days',
			start: moment().subtract(365, 'days').toDate(),
			end: moment().toDate()
		},
		{ label: 'This Month', start: moment().startOf('month').toDate(), end: moment().toDate() },
		{ label: 'Year to Date', start: moment().startOf('year').toDate(), end: moment().toDate() }
	];
}

/** Hourly sampling for short ranges, daily beyond two weeks — the same rule
 *  `getBlockHeightSeries` applies, so chart timelines line up. */
export function intervalFor(range: DateRange): moment.Duration {
	return moment(range.end).diff(range.start, 'day') < 14
		? moment.duration(1, 'hour')
		: moment.duration(1, 'day');
}

export function isHourly(range: DateRange): boolean {
	return intervalFor(range).asHours() === 1;
}

/**
 * The sampling timeline for a range, ascending. Mirrors
 * `getBlockHeightSeries`: the end is floored to the hour or the day so points
 * land on round boundaries, then stepped backwards to the start.
 */
export function dateGrid(range: DateRange, interval: moment.Duration): Date[] {
	const start = moment(range.start);
	const end =
		interval.asHours() === 1 ? moment(range.end).startOf('hour') : moment(range.end).startOf('day');
	const out: Date[] = [];
	const cursor = end.clone();
	while (cursor.isSameOrAfter(start)) {
		out.push(cursor.toDate());
		cursor.subtract(interval);
	}
	return out.reverse();
}
