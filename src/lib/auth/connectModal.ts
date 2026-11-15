/**
 * The connect-wallet dialog, opened from anywhere.
 *
 * It used to live inline in `LandingPage`, which was fine while the landing
 * page was the only place you could connect from. Now the swap screen is the
 * app's front door: the header's Connect pill and the swap CTA both need the
 * same dialog, and neither is inside the landing page. So the dialog moved to
 * `ConnectModal.svelte` (rendered once in the root layout) and this store is
 * how anything asks for it.
 */
import { writable } from 'svelte/store';

export const connectOpen = writable(false);

export function openConnect() {
	connectOpen.set(true);
}

export function closeConnect() {
	connectOpen.set(false);
}
