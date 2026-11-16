/**
 * Tells a horizontal scroller's owner whether there is content hidden off
 * either end, so it can show the arrow that says "this row scrolls".
 *
 * A row that overflows silently looks like a row that has been cut off: the
 * top bar's nav and the wallet's tab row both end mid-word on a phone, and
 * nothing on screen says you can swipe. The arrow only earns its place when
 * it appears exactly when there IS more, which is why this measures rather
 * than assuming a width.
 *
 * `scrollWidth` is rounded by the browser and can sit a sub-pixel away from
 * `clientWidth` on a row that is not actually scrollable, hence the 1px
 * tolerance on both ends — without it the arrow flickers on at rest.
 *
 * Children are observed as well as the scroller: a web font landing, or a
 * balance arriving and widening a label, changes the overflow without
 * resizing the scroller itself.
 */
export type ScrollEdges = {
	/** Content is hidden off the left (the reader has scrolled). */
	start: boolean;
	/** Content is hidden off the right (there is more to come). */
	end: boolean;
};

export function scrollEdges(node: HTMLElement, onchange: (edges: ScrollEdges) => void) {
	let report = onchange;
	let last = '';

	const measure = () => {
		const max = node.scrollWidth - node.clientWidth;
		const next: ScrollEdges = {
			start: node.scrollLeft > 1,
			end: max > 1 && node.scrollLeft < max - 1
		};
		const key = `${next.start}|${next.end}`;
		if (key === last) return;
		last = key;
		report(next);
	};

	node.addEventListener('scroll', measure, { passive: true });
	const observer = new ResizeObserver(measure);
	observer.observe(node);
	for (const child of node.children) observer.observe(child);
	measure();

	return {
		update(next: (edges: ScrollEdges) => void) {
			report = next;
		},
		destroy() {
			node.removeEventListener('scroll', measure);
			observer.disconnect();
		}
	};
}
