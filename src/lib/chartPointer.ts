/**
 * Map a pointer's page x onto the index of the nearest plotted point.
 *
 * ⚠️ Moved to `$lib/calc` (§9 Charts) with every other calculation in the
 * app. This file re-exports it so LineChart and `chartPointer.test.ts` keep
 * their import path.
 */
export { pointerIndex } from '$lib/calc';
