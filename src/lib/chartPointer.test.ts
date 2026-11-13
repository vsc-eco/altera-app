import { describe, expect, it } from 'vitest';
import { pointerIndex } from './chartPointer';

/** A 30-point chart, 744px of plot area inside a 52px left gutter. */
const GUTTER = 52;
const BOX_LEFT = 100;
const POINTS = 30;
const PLOT_WIDTH = 744;
const CHUNK = PLOT_WIDTH / (POINTS - 1);
const LAST = POINTS - 1;

/** Where the chart actually draws point `i`. */
const xOfPoint = (i: number) => BOX_LEFT + GUTTER + i * CHUNK;

describe('pointerIndex', () => {
	it('returns the point the pointer is sitting on, gutter or not', () => {
		for (const gutter of [0, GUTTER]) {
			for (const i of [0, 1, 7, 15, 29]) {
				const x = BOX_LEFT + gutter + i * CHUNK;
				expect(pointerIndex(x, BOX_LEFT, gutter, CHUNK, LAST)).toBe(i);
			}
		}
	});

	it('does not drift when the chart has a left gutter', () => {
		// The regression: `+ marginLeft` instead of `- marginLeft` offset the
		// result by 2·gutter/chunk points — ~4 here — only once a y axis made
		// the gutter non-zero, which is why the gutter-less charts never showed it.
		const i = 12;
		expect(pointerIndex(xOfPoint(i), BOX_LEFT, GUTTER, CHUNK, LAST)).toBe(i);
		expect(pointerIndex(xOfPoint(i), BOX_LEFT, GUTTER, CHUNK, LAST)).not.toBe(
			i + Math.round((2 * GUTTER) / CHUNK)
		);
	});

	it('snaps to the nearer point between two of them', () => {
		const justPast = xOfPoint(5) + CHUNK * 0.4;
		expect(pointerIndex(justPast, BOX_LEFT, GUTTER, CHUNK, LAST)).toBe(5);
		const nearlyNext = xOfPoint(5) + CHUNK * 0.6;
		expect(pointerIndex(nearlyNext, BOX_LEFT, GUTTER, CHUNK, LAST)).toBe(6);
	});

	it('clamps inside the series rather than running off either end', () => {
		expect(pointerIndex(BOX_LEFT - 400, BOX_LEFT, GUTTER, CHUNK, LAST)).toBe(0);
		expect(pointerIndex(BOX_LEFT + 99999, BOX_LEFT, GUTTER, CHUNK, LAST)).toBe(LAST);
	});

	it('gives up on a chart with no points or no width', () => {
		expect(pointerIndex(500, BOX_LEFT, GUTTER, CHUNK, -1)).toBeNull();
		expect(pointerIndex(500, BOX_LEFT, GUTTER, 0, LAST)).toBeNull();
	});
});
