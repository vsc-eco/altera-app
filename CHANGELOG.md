# Changelog

All notable changes to Altera are documented here.

## [0.3.9] — 2026-05-26

### Fixes

- **`/login` and `/logout` no longer 500 on a direct/hard navigation in production.** Both routes defaulted to server-side rendering, so the Vercel function tried to server-render them and import the browser-only wallet SDK graph (Reown AppKit / wagmi / `@metamask/sdk` via the auth store) — whose optional deps aren't bundled into the function, throwing "Cannot find module" at request time. Reaching `/login` via the client-side redirect from `/` never crashed because `/` is an `(authed)` route with `ssr=false`. Both routes are now `ssr=false` to match, so they render client-side; `prerender` stays false so they're still served as functions with a CSR shell
- **Pool "Fee Earned" no longer shows a stray `NULL` currency in the Max range.** 84 `dex_pool_fee_events` (two pools, 2026-04-16→18) have a null `asset` and only the Max window reaches them; they bucketed under `"null"` and rendered as `… NULL`. They're now excluded at the query and guarded in aggregation (the underlying indexer rows still need their `asset` backfilled)

### Security

- Added a styled self-XSS warning in the browser console on load — deters the common scam of telling users to paste code into devtools, which in a non-custodial wallet can leak keys and drain funds

## [0.3.8] — 2026-05-25

### Pools

- Pool "Fee Earned" is now valued **per asset**. The fee column summed a pool's fees across both assets into one number and priced it all as the first asset — so HIVE-denominated fees were counted as HBD, inflating the figure several-fold (e.g. ~$382 shown vs ~$32 actual). Each asset's fees are now valued at its own price.
- Fee Earned is **range-aware** again — it tracks the selected 1d/7d/30d/Max window like Volume, instead of always showing all-time. We aggregate the raw per-asset `dex_pool_fee_events` (which carry a timestamp) for the chosen window rather than the all-time `dex_pool_fees_by_asset` rollup
- Time-range buttons are disabled while a fetch is in flight, and stale responses are dropped if the range changes mid-request — prevents overlapping queries from showing the wrong window's numbers
- "My liquidity" no longer flashes in and out when changing the timeframe. The section re-fetched positions on every range change and rendered during the loading window, then hid when empty; it now only renders once positions are loaded

### Staking (sHBD)

- The staking card's "Next payout" shows an estimate (`≈ N days`) instead of a hardcoded `—`. sHBD interest is the VSC gateway's L1 HBD-savings interest, distributed to holders automatically (~monthly); the estimate is `hbd_claim` (last distribution block) + ~30 days, shown only when the user holds sHBD

### Witness Assistant

- Added an `ⓘ` tooltip beside the Stake and Unstake headings explaining what staking does — deposits HIVE into VSC, locked while staked, ~1-day unstake cooldown, Hive accounts only — with a link to the docs
- Loosened the cramped field spacing in the stake / unstake forms

## [0.3.7] — 2026-05-21

### Infrastructure (CORS elimination)

- All GraphQL requests now route through a same-origin server proxy (`/api/gql?service=vsc|indexer`) instead of being fetched cross-origin from the browser. The backend tightened its CORS policy during the security audit, so non-default nodes (e.g. a user's own `magi.milohpr.com`) failed preflight; forwarding server-to-server sidesteps CORS entirely while preserving per-user node switching via the `x-gql-upstream` header. SSRF-guarded against the shared node allowlist
- Node health probes (`refreshNode`) now run server-side via `/api/node-probe?category=indexer|vsc|hive` instead of probing nodes from the browser. Hive RPC and several indexer/VSC nodes don't expose CORS for our origin, so client-side probing always failed, spammed the console on every page load, and meant Hive auto-selection never actually worked. Server-to-server probing has no CORS, so freshness ranking is now real
- Hive account lookups (`getHiveAccounts`) and profile-pic fetches now pass our configured Hive node instead of Aioha's hardcoded `techcoderx.com` default (which is down / lacks CORS)

### Fixes

- Fixed two `select.test.ts` fixtures that used non-allowlisted hostnames (`my-manual`, `legacy-custom`) and started failing once manual overrides were gated against the allowlist (APP-03/04)

## [0.3.6] — 2026-05-20

### Fixes

- CSP now allows `https://va.vercel-scripts.com` — Vercel Web Analytics was being blocked in prod by the audit-added `script-src`. Listed in both `script-src` and `script-src-elem` for browsers that consult the latter first
- Pruned `https://techcoderx.com` and `https://api.deathwing.me` from `FALLBACK_HIVE_RPC_NODES` — both unreachable from the browser (0% uptime / 503 / no CORS) so they only generated console noise on every health probe. Users can still add them back via `PUBLIC_HIVE_RPC_NODES` env var

## [0.3.5] — 2026-05-20

### Swap (QuickSwap dashboard card)

- Detail rows now spread vertically with `flex: 1` + `space-evenly` so the area between slippage and the Swap button doesn't sit half-empty
- "Min amount received" and "Price impact" are always visible — show `—` placeholder until the pool calc resolves, instead of popping in and out and shifting layout
- Cleared FROM amount now correctly empties the TO field (was leaving the stale converted value behind because `expectedOutput` wasn't being reset in early-return branches of the swap calc)
- Empty TO field renders the grey placeholder instead of literal "0" after clearing FROM

### Infrastructure

- Balance-history GraphQL query batched into chunks of 12 aliases (84 field selections) with bounded concurrency of 4 parallel requests — satisfies the indexer's new 100-selection cap (security hardening on the backend) and avoids flooding the browser's per-origin connection pool on 365-day ranges

### Fixes

- Portfolio chart default range: dropdown label and graph data now agree on "Last 7 Days" at first load (previously the dropdown said 7 days while the data was for 30)

### Internals (TX state cleanup pass 2)

- Removed redundant `enteredAmount` fallback from `TxStateBase` — relied-upon comment admitted it was in the wrong denomination across coins; consumers now use `fromAmount`/`toAmount` with proper conversion
- Moved `fee` field from `TxStateBase` to the per-flow subclasses that actually carry one (`SwapTxState`, `DepositTxState`, `WithdrawTxState` — not `TransferTxState`)
- Generalized `btcDeductFee` / `btcMaxFee` (now `deductFee` / `maxFee`) and moved them off the base class to `WithdrawTxState` + `TransferTxState` only — `sendUtils` reads them via `instanceof` narrowing
- Pruned dead exports from `sendOptions` (`SendAccount` type + 3 constants, `CoinOptions.default`, `TransferMethod.fees`, commented-out network variants) and `sendUtils` (`getFromOptions`, `AccountOptionParam`)
- Deleted orphan `AccountInfo.svelte` (no imports remained)

## [0.3.4] — 2026-05-20

### Lightning

- Added Lightning withdraw support for KeepSats on v4vapp
- Added Lightning deposit support for Sats direct via v4vapp

## [0.3.3] — 2026-05-19

### Security

- Baseline security response headers added (`hooks.server.ts`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (geolocation/microphone/camera off), and a Content-Security-Policy with `frame-ancestors 'none'`, `worker-src 'self'`, and `object-src 'none'` — addresses the missing clickjacking/MIME-sniffing protections (audit APP-08). CSP is intentionally permissive (keeps `'unsafe-inline'`/`'unsafe-eval'` for SvelteKit hydration and the WASM-based Hive signer) so it hardens framing/sniffing without breaking the app

### Infrastructure

- Multi-node failover: indexer / VSC API / Hive RPC endpoints are health-checked on app open and the freshest node is auto-selected (5-min cache); optional `PUBLIC_INDEXER_NODES` / `PUBLIC_VSC_API_NODES` / `PUBLIC_HIVE_RPC_NODES` runtime overrides, hardcoded fallbacks otherwise
- Preferences: per-endpoint "Custom" toggle to pin a specific node (off = automatic, shows the auto-selected node)

## [0.3.2] — 2026-05-18

### Swap

- Selected token chips (FROM/TO) now show a thin purple border + role badge instead of being dimmed
- Disabled tokens: cleaner dim treatment; removed diagonal strike-through
- Tooltip on disabled chips is now readable (was rendering see-through due to parent opacity)

### Infrastructure

- Update toast no longer polls every 2 minutes — checks version on tab visibility change instead
- Dismissing the update toast remembers the version (sessionStorage) so it doesn't keep nagging for the same update
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
