# Magi SDK

Embeddable cross-chain swap widget for the Magi (VSC) DEX. Supports HIVE, HBD, and BTC swaps — mainnet to mainnet.

Built for **Hive Keychain**, **Peakd**, **Ecency**, and any app that wants to offer cross-chain swaps.

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
