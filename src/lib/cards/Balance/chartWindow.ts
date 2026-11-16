/**
 * The visible window over a chart's points.
 *
 * ⚠️ Moved to `$lib/calc` (§9 Charts) with every other calculation in the
 * app. This file re-exports it so the chart components and
 * `chartWindow.test.ts` keep their import path.
 */
export {
	MIN_POINTS,
	resolveWindow,
	clampWindow,
	zoomWindow,
	panWindow
} from '$lib/calc';
export type { ChartWindow } from '$lib/calc';
