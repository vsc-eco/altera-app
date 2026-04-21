# Magi SDK

Embeddable cross-chain swap widget for the Magi (VSC) DEX. Supports HIVE, HBD, and BTC swaps — mainnet to mainnet.

Built for **Hive Keychain**, **Peakd**, **Ecency**, and any app that wants to offer cross-chain swaps.

**Live demo:** [magisdk.okinoko.io](https://magisdk.okinoko.io) — every integration mode on one page with copy-pasteable snippets.

## Packages

| Package | Description |
|---|---|
| `@magi/core` | Swap math (CLP curve), operation builders, types. Zero dependencies. |
| `@magi/sdk` | Pool/price/balance providers, `quickSwap()` orchestrator, mapping bot client. |
| `@magi/widget` | React component + `<magi-quickswap>` web component. Drop-in swap UI. |

## Swap Paths

All swaps are mainnet → mainnet. The Magi L2 is used internally for routing — users don't interact with it directly.

| From | To | How it works |
|---|---|---|
| HIVE → HBD | Deposit to Magi, swap, withdraw to Hive L1 |
| HIVE → BTC | Deposit to Magi, two-hop swap (HIVE→HBD→BTC), bridge out to BTC address |
| HBD → HIVE | Deposit to Magi, swap, withdraw to Hive L1 |
| HBD → BTC | Deposit to Magi, swap, bridge out to BTC address |
| BTC → HIVE | User sends BTC to a generated deposit address, mapping bot swaps + delivers HIVE |
| BTC → HBD | User sends BTC to a generated deposit address, mapping bot swaps + delivers HBD |

## Quick start

Five minutes end-to-end for a React + Aioha host app. If you're using a different framework, the Web Component path in [Integration Paths](#integration-paths) follows the same shape.

### 1. Install

```bash
pnpm add @magi/widget @magi/sdk @magi/core @aioha/aioha
# or: npm install / yarn add
```

`@magi/core` and `@magi/sdk` are listed because `@magi/widget` treats them as peers — you'll reach for `@magi/sdk` directly for the no-UI modes later. `@aioha/aioha` is an **optional peer** of the widget; include it when you want the React + Aioha flow.

### 2. Register Aioha providers

See [Aioha setup](#aioha-setup) below for the full flow. The short version:

```ts
import { Aioha } from '@aioha/aioha';

const aioha = new Aioha();
aioha.registerKeychain();
aioha.registerHiveSigner({ app: 'your-app', callbackURL: window.location.origin });
aioha.registerHiveAuth({ name: 'your-app' });
aioha.loadAuth(); // restore any persisted session
```

### 3. Log the user in with the **posting** key

```ts
import { KeyTypes } from '@aioha/aioha';

const providers = aioha.getProviders();
const res = await aioha.login(providers[0], 'alice', {
	msg: 'Sign in to Your App',
	keyType: KeyTypes.Posting,
});
```

Posting key is fine for sign-in; the widget re-asks for the **active** key at swap time because transfers require it. See [Posting vs active](#posting-vs-active-key) for why this matters.

### 4. Drop in the widget

```tsx
import { MagiQuickSwap } from '@magi/widget';
import { KeyTypes } from '@aioha/aioha';
import '@magi/widget/styles.css';

<MagiQuickSwap
	aioha={aioha}
	username="alice"
	keyType={KeyTypes.Active}   // widget uses Active when signing swaps
	onSuccess={(txId) => console.log('Swap broadcast:', txId)}
	onError={(err) => console.error(err)}
/>
```

That's it — the widget auto-queries Alice's HIVE/HBD balances, pulls pool reserves from the Magi indexer, and shows live price previews as she types.

### 5. First real swap (recommended)

Swap **1 HBD → HIVE** as your first test — lowest blast radius, same code path as BTC swaps minus the cross-chain bridge step. If the transfer + `custom_json` pair broadcasts and you see the Hive balance settle, every other path works too.

## Aioha setup

Aioha is the wallet abstraction layer the widget calls into for signing. If your app is already using Aioha, you pass **your existing instance** to the widget — don't create a second one. If not, here's the minimum viable setup.

### Providers

Register at least one; most apps register all three for user choice:

```ts
const aioha = new Aioha();

aioha.registerKeychain();                          // browser extension; no config
aioha.registerHiveSigner({
	app: 'your-app',
	callbackURL: window.location.origin,           // OAuth return URL
});
aioha.registerHiveAuth({ name: 'your-app' });      // QR / mobile push
```

Keychain is the most common on desktop; HiveAuth is better on mobile. HiveSigner works as a fallback and doesn't require a browser extension.

### Posting vs active key

Hive distinguishes several keys by privilege. The widget needs **two** of them at different points:

| Phase | Key | Why |
|---|---|---|
| Login | Posting | Lowest-privilege key that proves identity; safe for long-lived sessions |
| Swap | Active | Required to sign `transfer` ops (deposits into Magi, withdrawals out) |

Don't try to log the user in with the active key — Keychain will prompt them every page load and degrade UX. Log in with posting, then pass `keyType={KeyTypes.Active}` to the widget; it will request an active signature only when the swap is actually broadcast.

### Persisting login

```ts
useEffect(() => {
	const a = new Aioha();
	a.registerKeychain();
	// …register others…
	if (a.loadAuth()) {
		// session restored, aioha.getCurrentUser() returns the username
	}
	setAioha(a);
}, []);
```

`loadAuth()` reads the last session from `localStorage`. Without it, the user re-authenticates on every reload. This is the single most common "bug" in first integrations.

### Sharing an existing Aioha instance

If your app already has an Aioha instance (most Hive apps do), skip the `new Aioha()` call and pass your instance directly into `<MagiQuickSwap aioha={existingAioha} …>`. The widget only calls `login`, `logout`, `signAndBroadcast`, and a handful of getters — it won't step on any providers you've already registered.

## Integration Paths

### 1. React app (Ecency, custom frontends)

```tsx
import { MagiQuickSwap } from '@magi/widget';

<MagiQuickSwap
  aioha={aiohaInstance}
  username="lordbutterfly"
  keyType={KeyTypes.Active}  // from @aioha/aioha
  onSuccess={(txId) => console.log('Swap broadcast:', txId)}
/>
```

### 2. Web component (Peakd / Vue / vanilla JS)

```html
<script type="module">
  import '@magi/widget/webcomponent';
</script>

<magi-quickswap id="swap"></magi-quickswap>

<script>
  const el = document.getElementById('swap');
  // Object props MUST be set as JS properties, not HTML attributes
  el.aioha = yourAiohaInstance;
  el.username = 'lordbutterfly';
  el.keyType = KeyTypes.Active;
  el.onSuccess = (txId) => console.log(txId);
</script>
```

### 3. SDK only — no UI (Keychain extension swap tab)

```ts
import { createMagi, CoinAmount } from '@magi/sdk';

const magi = createMagi();

// Build the ops, sign and broadcast yourself
const { ops, preview } = await magi.buildQuickSwap({
  username: 'lordbutterfly',
  assetIn: 'HBD',
  amountIn: CoinAmount.fromDecimal('10', 'HBD'),
  assetOut: 'BTC',
  recipient: 'bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss',
  slippageBps: 100
});

// ops = [transferOp, customJsonOp] — broadcast with your own signer
```

### 4. BTC deposit flow (no wallet connection needed)

```ts
const magi = createMagi();

const { address } = await magi.getBtcDepositAddress({
  recipient: 'lordbutterfly',  // Hive account to receive
  assetOut: 'HIVE',            // or 'HBD'
  destinationChain: 'HIVE'
});

// address = bc1q... — user sends BTC here from any wallet
// Mapping bot watches the deposit and delivers HIVE/HBD to the recipient
```

## Props

### `<MagiQuickSwap>` / `<magi-quickswap>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `aioha` | AiohaLike | For HIVE/HBD input | Aioha instance for signing. Not needed for BTC input. |
| `username` | string | For HIVE/HBD input | Hive username. Widget auto-queries L1 balance when set. |
| `keyType` | KeyTypes | For signing | Must be `KeyTypes.Active` (transfers require active key). |
| `config` | MagiConfig | No | Defaults to `MAINNET_CONFIG`. |
| `defaultAssetIn` | SwapAsset | No | Default: `'HBD'`. |
| `defaultAssetOut` | SwapAsset | No | Default: `'BTC'`. |
| `defaultSlippageBps` | number | No | Default: `100` (1%). |
| `availableBalance` | bigint | No | Override auto-queried balance (smallest units). |
| `pools` | PoolProvider | No | Custom pool data source. Defaults to Magi indexer. |
| `prices` | PriceProvider | No | Custom USD prices. Defaults to pool-derived (HBD=$1 peg). |
| `onSuccess` | (txId: string) => void | No | Called after successful broadcast. |
| `onError` | (err: Error) => void | No | Called on failure. |
| `className` | string | No | Extra CSS class on the root element. |

## Error handling and edge cases

The widget handles common failure modes internally (disabled button, inline message) — your `onError` callback is a notification signal, not an error boundary. Log it, optionally surface a toast, then let the widget restore input state.

### Failures you'll see in real deployments

| Condition | Widget behavior | Your options |
|---|---|---|
| User rejects the signature prompt | `onError(new Error('User cancelled'))`; amount inputs stay populated | Surface a toast; no retry needed, user can click Swap again |
| Insufficient HIVE/HBD balance | Swap button disabled; inline "Not enough HBD" | Preempt with your own balance check before calling the widget if you want a smoother UX |
| Insufficient pool liquidity (slippage exceeds tolerance) | Preview shows red; button disabled | Prompt user to raise `defaultSlippageBps` or lower the amount |
| Magi indexer unreachable | Pool data empty; preview shows `—`; button disabled | Widget retries automatically. Optionally pass a custom `pools` prop with your own cache if your app needs offline-tolerant UX |
| Mapping bot unreachable (BTC flows only) | `getBtcDepositAddress` rejects | Catch + display "BTC bridge temporarily unavailable, try again shortly" |
| Hive L1 broadcast fails (bad node, nonce race) | `onError` fires with the underlying aioha error | Usually transient; a single retry is fine. If persistent, probably a bad RPC — check `new Aioha(hiveApiUrl)` |
| Two-hop path (HIVE → BTC) partially completes | `onSuccess(txId)` fires on the Hive L1 broadcast; subsequent L2 + bridge hops are async | Monitor the referenced tx on an explorer or the indexer; widget doesn't block UI after L1 confirmation |

### Debugging tips

- **`custom_json` looks wrong?** Log the `ops` array from `@magi/sdk`'s `buildQuickSwap()` (Integration mode 3) before broadcasting. Op shape is the contract between the SDK and Magi L2; anything else is downstream.
- **Widget shows stale prices?** Pool data is cached per-instance; remount the component to force a refetch, or pass a custom `pools` provider with your own TTL.
- **Web Component props not applying?** They must be set as **JS properties**, not HTML attributes — attributes only carry strings, and the widget expects live object references for `aioha`, `onSuccess`, etc.
- **"Invalid hook call" errors in tests or monorepos?** Duplicate React copies. Ensure `@magi/widget` resolves to the same `react` as your host app (pnpm handles this via hoisting; npm/yarn sometimes need `resolutions`/`overrides`).
- **CORS / proxy concerns?** All three endpoints (indexer, Hive API, mapping bot) ship with `Access-Control-Allow-Origin: *` — you do not need a backend proxy. If you're seeing CORS errors, it's almost certainly a browser extension or ad-blocker intercepting the request.

### Things that cannot fail gracefully

- **User has no Hive account at all** — there's no flow in the widget to create one. Either redirect to `signup.hive.io` or gate widget rendering behind a "Create Hive account first" CTA in your app.
- **User's wallet provider is unavailable** (e.g. Keychain not installed) — Aioha throws during `login()` before the widget is involved. Handle at the login step, not inside the widget.

## Theming

The widget uses CSS custom properties scoped to `.magi-quickswap`. Override any `--magi-*` variable to match your host app.

Default is a neutral light theme. An Altera dark theme is available:

```ts
import '@magi/widget/themes/altera-dark.css';
```

### Variables

| Variable | Default | Description |
|---|---|---|
| `--magi-card-bg` | `#ffffff` | Card background |
| `--magi-card-border` | `#e2e5e9` | Card border |
| `--magi-card-shadow` | subtle shadow | Card shadow |
| `--magi-accent` | `#4f46e5` | Primary accent (buttons, highlights) |
| `--magi-accent-hover` | `#4338ca` | Accent hover state |
| `--magi-green` | `#16a34a` | Success color |
| `--magi-red` | `#dc2626` | Error color |
| `--magi-text` | `#111827` | Primary text |
| `--magi-text-secondary` | `#4b5563` | Secondary text |
| `--magi-text-muted` | `#9ca3af` | Muted text |
| `--magi-field-bg` | `#f3f4f6` | Input field background |
| `--magi-field-border` | `#e5e7eb` | Input field border |
| `--magi-font` | Inter, system-ui | Font family |

## Referral Fee

Integrators can earn a referral fee on outbound BTC swaps by passing a referral config:

```ts
import { MAINNET_CONFIG } from '@magi/sdk';

const config = {
  ...MAINNET_CONFIG,
  referral: {
    beneficiary: 'hive:yourapp',
    bps: 25  // 0.25%
  }
};

<MagiQuickSwap config={config} ... />
```

The referral fee only applies when:
- Output asset is BTC (not HIVE or HBD)
- `destination_chain` is set
- Input USD value meets the optional `usdThreshold`

## Development

```bash
pnpm install
pnpm build        # build all packages
pnpm test         # run all tests (includes live API tests)
pnpm demo         # start the demo at localhost:5173
```

## Architecture

```
@magi/core          Pure math + op builders. No network calls.
    ↓
@magi/sdk           Pool, price, balance providers. quickSwap orchestrator.
    ↓
@magi/widget        React component + web component. UI layer.
```

The SDK queries:
- **Magi indexer** (`indexer.magi.milohpr.com`) for pool reserves
- **Hive API** (`api.hive.blog`) for L1 balances
- **Mapping bot** (`btc.magi.milohpr.com`) for BTC deposit addresses

All endpoints have `Access-Control-Allow-Origin: *` — no proxy needed.
