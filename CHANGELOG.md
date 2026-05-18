# Changelog

All notable changes to Altera are documented here.

## [0.3.2] — 2026-05-18

### Swap
- Selected token chips (FROM/TO) now show a thin purple border + role badge instead of being dimmed
- Disabled tokens: cleaner dim treatment; removed diagonal strike-through
- Tooltip on disabled chips is now readable (was rendering see-through due to parent opacity)

### Infrastructure
- Update toast no longer polls every 2 minutes — checks version on tab visibility change instead
- New reusable `Tooltip` component (`$lib/components/Tooltip.svelte`) shared by chip + swap-arrow tooltips

### Internals
- Removed dead `enabled()` callbacks from `Coin` and `Network` definitions
- Removed unused `account` field from `TxStateBase` (cleaner type, dropped always-false template branches in `ReviewTransfer`)

## [0.3.1] — 2026-05-18

### Tokens
- Bump `@vsc.eco/token-widget` to 0.0.2
- NFT details modal — click an NFT tile to see its info
- Template-id mint tab in the token widget

## [0.3.0] — 2026-05-15

### Swap
- Interactive swap direction toggle with icon crossfade (single arrow → double arrow on hover)
- Auto-switch tokens when picking a token already in the other slot
- FROM/TO role badges on selected token chips in picker dialog
- Network pill in "You Receive" section with color differentiation for external chains
- Replace TO display with AmountInput for consistent digit alignment

### Fixes
- Dialog close button not clickable in nested modals (deposit review)
- Lightning deposit currency picker no longer shows HIVE/HBD options

### Infrastructure
- Deploy notification toast — polls server version, prompts refresh on new deploy
- CHANGELOG.md for release tracking

## [0.2.0] — 2026-05-15

### Swap
- Gate "Review Swap" button on pool data; retry on fetch failure
- Show loading state while pool values and min-amount load
- "Price unavailable" fallback when price feeds are down
- Disable already-selected token in opposite picker
- "Done" button now closes popup after broadcast
- Discard stale exchange-rate estimates when pool calc resolves

### Dashboard
- Balance card height matches portfolio; scrollable token list
- Isolate CoinGecko ETH fetch so it fails independently
- Improve layout filling; add Ethereum to market prices

### Pools
- Label LP and protocol fees separately in fee column
- Click a pool transaction row to open inline detail popup
- Fix duplicate pool rows; show token symbol in fallback icons

### Transactions
- Display add-liquidity and remove-liquidity as distinct transaction types

### Fixes
- Catch-all route activates 404 handler on unknown paths
- Lowercase EVM address in EIP-155 DIDs (fixes balance not showing for EVM wallets)

## [0.1.0] — 2026-05-04

Initial tracked release on `feature/dashboard-ui`.
