/**
 * Map a pointer's page x onto the index of the nearest plotted point.
 *
 * Pulled out of LineChart so it can be tested without layout: jsdom has none,
 * and this arithmetic shipped a sign error that was invisible for as long as
 * every chart had a zero-width left gutter (`+ marginLeft` instead of `-`,
 * which put the crosshair 2·gutter/chunk points right of the pointer the
 * moment a y axis gave the chart one).
 *
 * Point `i` is drawn at `xScale(date) ∈ [marginLeft, width - marginRight]`, so
 * the pointer is measured from the START of that range and divided by the
 * spacing between points.
 */
export function pointerIndex(
	clientX: number,
	boxLeft: number,
	marginLeft: number,
	chunkSize: number,
	lastIndex: number
): number | null {
	if (lastIndex < 0) return null;
	const fromLeft = clientX - boxLeft - marginLeft;
	const index = Math.round(fromLeft / chunkSize);
	if (!isFinite(index)) return null;
	if (index < 0) return 0;
	if (index > lastIndex) return lastIndex;
	return index;
}
