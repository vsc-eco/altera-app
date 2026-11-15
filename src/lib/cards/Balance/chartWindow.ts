/**
 * The visible window over a chart's points.
 *
 * Zoom and pan here are a window over data that has ALREADY been fetched, not
 * a new query: the range dropdown decides what is loaded, this decides how
 * much of it is on screen. Zooming is therefore instant, and zooming out can
 * never reveal more than the selected range.
 *
 * `null` means "all of it". Keeping that distinct from `{s: 0, e: n}` is what
 * lets a fresh fetch drop the window by assignment instead of re-clamping
 * indices against a different number of points.
 */
export type ChartWindow = { s: number; e: number } | null;

/** Fewer points than this on screen stops being a chart. */
export const MIN_POINTS = 4;

/** The window actually in effect, with `null` resolved against the data. */
export function resolveWindow(win: ChartWindow, pointCount: number): { s: number; e: number } {
	return win ?? { s: 0, e: pointCount };
}

/**
 * Pins a window inside the data and no narrower than `MIN_POINTS`.
 *
 * At an edge it SLIDES rather than shrinking: panning past the end of the data
 * keeps the span and stops, instead of squeezing the window against the
 * boundary and silently zooming in.
 */
export function clampWindow(
	start: number,
	end: number,
	pointCount: number
): { s: number; e: number } {
	if (pointCount <= MIN_POINTS) return { s: 0, e: Math.max(0, pointCount) };
	const span = Math.min(pointCount, Math.max(MIN_POINTS, Math.round(end - start)));
	let s = Math.round(start);
	if (s < 0) s = 0;
	if (s + span > pointCount) s = pointCount - span;
	return { s, e: s + span };
}

/**
 * Zoom about the middle of what is on screen. `factor` below 1 zooms in.
 * Returns `null` once the window covers everything, so "zoomed out fully" and
 * "never zoomed" are the same state and the reset control disables itself.
 */
export function zoomWindow(win: ChartWindow, factor: number, pointCount: number): ChartWindow {
	const { s, e } = resolveWindow(win, pointCount);
	const mid = (s + e) / 2;
	const span = (e - s) * factor;
	const next = clampWindow(mid - span / 2, mid + span / 2, pointCount);
	return next.s === 0 && next.e === pointCount ? null : next;
}

/** Move by a fraction of the visible span; negative goes back in time. */
export function panWindow(win: ChartWindow, fraction: number, pointCount: number): ChartWindow {
	const { s, e } = resolveWindow(win, pointCount);
	const step = (e - s) * fraction;
	return clampWindow(s + step, e + step, pointCount);
}
