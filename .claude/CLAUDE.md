# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Altera is a multi-chain wallet and DEX interface built with **SvelteKit 2 + Svelte 5 (runes mode)** supporting Hive, Bitcoin, Ethereum, and VSC (Vertical Scaling Collective) chains. Deployed on Vercel.

## Commands

- `pnpm dev` — start dev server (HTTPS via mkcert)
- `pnpm build` — production build
- `pnpm check` — type-check with svelte-check
- `pnpm lint` — prettier + eslint
- `pnpm format` — auto-format
- `pnpm test` — run all tests once
- `pnpm test:unit` — run tests in watch mode
- `pnpm test:unit -- --run src/path/to/file.test.ts` — run a single test file

## Architecture

### Framework & Reactivity
- Svelte 5 **runes mode** is enforced (`$state`, `$derived`, `$effect` — no legacy `$:`)
- SSR is disabled for authenticated routes (`ssr = false`)
- Path aliases: `$lib` → `src/lib`, `@styles` → `src/styles`, `$houdini` → `.houdini/`

### Routing (`src/routes/`)
- `(authed)/` — route group requiring authentication; layout handles auth guard and redirects
- `api/` — server-side API routes (Coinbase onramp, CMC proxy, BTC address validation)
- `login/`, `logout/`, `hivesigner/` — public auth routes

### Dual Authentication System (`src/lib/auth/`)
Two parallel auth providers merged into a single derived `authStore`:
- **Hive** (`auth/hive/`) — via Aioha library (Keychain, HiveSigner, HiveAuth, Ledger, PeakVault)
- **EVM** (`auth/reown/`) — via Reown AppKit + Wagmi (MetaMask, WalletConnect, etc.)

Auth store shape: `{ status: 'none' | 'pending' | 'authenticated', value?: { username?, address, did, provider, ... } }`
DIDs: `hive:username` for Hive, `did:pkh:eip155:1:address` for EVM.

### Data Layer
- **Houdini** (GraphQL client) talks to `https://api.vsc.eco/api/v1/graphql` — generates types in `.houdini/`
- **Svelte stores** (`src/lib/stores/`) — auth, balances (polled every 2s), transactions
- **localStorage** — pending transactions, GraphQL URL override, network ID, user preferences

### Transaction Pipeline (`src/lib/magiTransactions/`)
Chain-specific transaction builders for Hive, EVM, and Bitcoin operations. The send/swap flow uses a Zag.js step machine (`src/lib/sendswap/StepsMachine.svelte`) collecting details into a `SendTxDetails` store, then dispatching via `sendUtils.ts`.

### UI Components
- **Zag.js** (`@zag-js/svelte`) — headless components (dialog, select, menu, steps, etc.) with custom styling
- **Lucide Svelte** — icons
- **SCSS** with CSS custom properties for light/dark theming (`src/styles/`)

## Svelte 5 Reference

When unsure about Svelte 5 or SvelteKit APIs, consult `.claude/llms.txt` for official documentation. This is especially important for runes syntax (`$state`, `$derived`, `$effect`, `$props`, `$bindable`), snippet blocks (`{#snippet}` / `{@render}`), and SvelteKit conventions (load functions, form actions, hooks).

## Code Style

- **Formatter**: Prettier — tabs, single quotes, no trailing commas, 100 char width
- **Svelte components**: PascalCase filenames
- **Utilities/stores**: camelCase filenames
- Package manager: **pnpm** (v10.27.0)

## Testing

Vitest with two project configurations:
- **Client tests** (`*.svelte.test.ts`) — jsdom environment, `@testing-library/svelte`
- **Server tests** (`*.test.ts`, non-svelte) — Node environment
