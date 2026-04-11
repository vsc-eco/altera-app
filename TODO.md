# Future Improvements

## Dialog global selectors cleanup

`src/lib/zag/Dialog.svelte` uses extensive `:global()` selectors to force glass theme colors into slotted dialog content (`h1`-`h6`, `label`, `span`, `p`, `input`, `textarea`, `fieldset`, `hr`). These should be unnecessary since `:root` variables in `base.scss` already set the same values. Investigate whether removing these global overrides breaks anything — if not, remove them and let components inherit from `:root` naturally.

## BTC Balance

- query the actual contract state for this balance, NOT the indexer
