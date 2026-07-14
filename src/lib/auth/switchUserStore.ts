import { writable } from 'svelte/store';

/**
 * Open-state for the Hive account-switcher panel (SwitchUserPanel, mounted
 * once in the (authed) layout). Both the sidebar's "Switch user" button and
 * the topbar account menu set this — a shared store instead of prop-drilling
 * through two unrelated component trees.
 */
export const switchUserPanelOpen = writable(false);
