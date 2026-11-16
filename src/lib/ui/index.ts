/**
 * The redesign's UI kit.
 *
 * Everything here is built on the global classes and `--alt-*` tokens in
 * `src/styles/redesign.scss`, so a component only ever carries the layout
 * rules the class cannot know about. Nothing here fetches, formats money or
 * knows about the chain — amounts come in already formatted (see
 * `$lib/calc` for the numbers).
 *
 * Rules of thumb:
 *   - a paragraph of explanation on a screen is a `Hint` that was not written
 *   - a button that navigates takes `href`, so it is a real link
 *   - set `box-sizing: border-box` in every new component; there is no global
 *     one in this app and `width: 100%` + padding overflows a 390px phone
 *
 * `InfoTooltip` is the OLD tooltip: it portals its popover to `<body>`, which
 * lands outside `.alt-root` and silently renders in the old dashboard
 * palette. On a redesigned page use `Hint`.
 */
export { default as Hint } from './Hint.svelte';
export { default as Button } from './Button.svelte';
export { default as Card } from './Card.svelte';
export { default as StatRow } from './StatRow.svelte';
export { default as Notice } from './Notice.svelte';
export { default as Spinner } from './Spinner.svelte';
export { default as EmptyState } from './EmptyState.svelte';
export { default as PageHeader } from './PageHeader.svelte';
export { default as LabelHint } from './LabelHint.svelte';
export { default as Faq } from './Faq.svelte';
export { scrollEdges, type ScrollEdges } from './scrollEdges';
