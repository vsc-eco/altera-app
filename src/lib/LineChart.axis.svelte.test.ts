/**
 * The y axis has to label a value at least as high as the line drawn on it.
 *
 * `scale.nice()` rounds the DOMAIN out but `ticks()` may stop below it: a max
 * of 1.71 nices to [0, 1.8], whose ticks are 0, 0.5, 1, 1.5. The top label
 * then read 1.5 with the line above it (section 5).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/svelte';
import LineChart from './LineChart.svelte';

/**
 * The chart sizes itself with `bind:clientWidth`, which Svelte implements with
 * a ResizeObserver — neither exists in jsdom, and a zero width makes the chart
 * render its empty state instead of an axis. Both are stubbed so the real
 * component runs.
 */
beforeAll(() => {
	(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get() {
			return 600;
		}
	});
});

function topTick(container: HTMLElement): number {
	const labels = [...container.querySelectorAll('text')]
		.map((t) => Number((t.textContent ?? '').replace(/[^0-9.-]/g, '')))
		.filter((n) => Number.isFinite(n));
	return Math.max(...labels);
}

const points = (values: number[]) =>
	values.map((value, i) => ({ date: new Date(2026, 10, i + 1), value }));

describe('LineChart y axis', () => {
	it('labels a tick at or above the highest value', () => {
		const { container } = render(LineChart, {
			data: points([0.2, 1.71, 0.9]),
			showYAxis: true,
			height: 200,
			formatTick: (v: number) => String(v)
		});
		expect(topTick(container)).toBeGreaterThanOrEqual(1.71);
	});

	it('holds for a range of awkward maxima', () => {
		for (const max of [1.71, 3.3, 7.4, 17.2, 0.37, 123.4]) {
			const { container } = render(LineChart, {
				data: points([0, max, max / 2]),
				showYAxis: true,
				height: 200,
				formatTick: (v: number) => String(v)
			});
			expect(topTick(container), `max ${max}`).toBeGreaterThanOrEqual(max);
		}
	});
});
