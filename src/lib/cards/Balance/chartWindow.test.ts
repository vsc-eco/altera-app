import { describe, expect, it } from 'vitest';
import {
	MIN_POINTS,
	clampWindow,
	panWindow,
	resolveWindow,
	zoomWindow,
	type ChartWindow
} from './chartWindow';

const N = 100;

describe('chartWindow', () => {
	it('treats null as the whole range', () => {
		expect(resolveWindow(null, N)).toEqual({ s: 0, e: N });
	});

	describe('clampWindow', () => {
		it('keeps the window inside the data', () => {
			expect(clampWindow(-20, 10, N)).toEqual({ s: 0, e: 30 });
			expect(clampWindow(90, 130, N)).toEqual({ s: 60, e: 100 });
		});

		/** The bug this guards: squeezing at the boundary instead of stopping
		 *  would zoom the user in every time they panned into the edge. */
		it('slides at an edge rather than shrinking', () => {
			const atEnd = clampWindow(95, 115, N);
			expect(atEnd.e - atEnd.s).toBe(20);
			expect(atEnd).toEqual({ s: 80, e: 100 });
		});

		it('never goes below the minimum span', () => {
			const tiny = clampWindow(50, 51, N);
			expect(tiny.e - tiny.s).toBe(MIN_POINTS);
		});

		it('never goes above the data', () => {
			expect(clampWindow(-50, 500, N)).toEqual({ s: 0, e: N });
		});

		it('copes with less data than the minimum span', () => {
			expect(clampWindow(0, 2, 2)).toEqual({ s: 0, e: 2 });
			expect(clampWindow(0, 0, 0)).toEqual({ s: 0, e: 0 });
		});
	});

	describe('zoomWindow', () => {
		it('zooms in about the middle of the view', () => {
			const z = zoomWindow(null, 0.6, N);
			expect(z).not.toBeNull();
			expect(z!.e - z!.s).toBe(60);
			// centred: equal margins either side
			expect(z!.s).toBe(20);
			expect(z!.e).toBe(80);
		});

		it('collapses back to null once it covers everything', () => {
			const zoomedIn = zoomWindow(null, 0.5, N);
			expect(zoomWindow(zoomedIn, 1 / 0.5, N)).toBeNull();
			expect(zoomWindow(null, 2, N)).toBeNull();
		});

		it('stops at the minimum span however hard you zoom', () => {
			let w: ChartWindow = null;
			for (let i = 0; i < 40; i++) w = zoomWindow(w, 0.6, N);
			expect(w!.e - w!.s).toBe(MIN_POINTS);
		});
	});

	describe('panWindow', () => {
		it('moves by a fraction of the visible span', () => {
			const w = zoomWindow(null, 0.2, N); // 20 wide, s=40
			expect(panWindow(w, 0.5, N)).toEqual({ s: 50, e: 70 });
			expect(panWindow(w, -0.5, N)).toEqual({ s: 30, e: 50 });
		});

		it('stops at the ends without changing the span', () => {
			const w = zoomWindow(null, 0.2, N);
			let left: ChartWindow = w;
			for (let i = 0; i < 20; i++) left = panWindow(left, -0.5, N);
			expect(left).toEqual({ s: 0, e: 20 });

			let right: ChartWindow = w;
			for (let i = 0; i < 20; i++) right = panWindow(right, 0.5, N);
			expect(right).toEqual({ s: 80, e: 100 });
		});

		/** Panning a full-range view has nowhere to go; it must not invent one. */
		it('does nothing when the whole range is already shown', () => {
			expect(panWindow(null, 0.5, N)).toEqual({ s: 0, e: N });
			expect(panWindow(null, -0.5, N)).toEqual({ s: 0, e: N });
		});
	});
});
