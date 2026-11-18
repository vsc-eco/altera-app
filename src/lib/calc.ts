/**
 * ───────────────────────────────────────────────────────────────────────────
 *  calc.ts — every number the app works out.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * One file, on purpose. The arithmetic used to live in about forty places:
 * `raw / 10 ** decimals` appeared in fourteen components, the Altera fee was
 * applied by four different expressions, five functions formatted a dollar
 * amount and three of them disagreed about sub-cent values. When a formula is
 * written down more than once, the copies drift — and in a wallet a drifted
 * formula is money.
 *
 * So: if a line multiplies, divides, rounds, or converts between units, it
 * belongs here. Components fetch, lay out and render. They do not compute.
 *
 * RULES FOR THIS FILE
 *
 *   1. No imports. Not one. That is what keeps it free of cycles (half the
 *      modules that call in here are imported by the other half) and what
 *      makes every function in it trivially unit-testable — see calc.test.ts
 *      next door.
 *   2. Primitives only at the boundary: numbers, bigints, strings, plain
 *      records. No `Coin`, no `CoinAmount`, no store. Callers unwrap first.
 *   3. Pure. No clock, no randomness, no I/O. Anything that needs `Date.now()`
 *      takes the time as an argument.
 *   4. Money that must be exact is a `bigint` in base units. `number` is for
 *      ratios, percentages and things already destined for a label.
 *
 * The sections are:
 *      §1  Units and decimals          §7   Resource credits
 *      §2  Basis points                §8   Staking and interest
 *      §3  Money formatting            §9   Charts
 *      §4  Exchange rates              §10  Bitcoin fees and spendable
 *      §5  Swap / AMM                  §11  Block heights and time
 *      §6  Pools and LP                §12  Small numeric helpers
 */

/** The one locale every formatter in the app uses. */
export const NUMBER_LOCALE = 'en-US';

// ═══════════════════════════════════════════════════════════════════════════
// §1  UNITS AND DECIMALS
//
// Every asset is held on chain as an integer in its smallest unit: HIVE and
// HBD at 3 decimal places (milli-units), BTC at 8 (satoshis), sats at 0. The
// UI shows the decimal form. These are the only two directions, and there is
// exactly one implementation of each.
// ═══════════════════════════════════════════════════════════════════════════

/** `10 ** decimals`, the scale factor between base units and display units. */
export function unitScale(decimals: number): number {
	return 10 ** decimals;
}

/**
 * Base units → a display number. `12345` at 3 dp is `12.345`.
 *
 * This is the `raw / 10 ** decimals` that was written out by hand in fourteen
 * components. Non-finite input yields 0 rather than NaN: a NaN here used to
 * propagate into a total and print "$NaN" over a funded wallet.
 */
export function toDisplay(
	base: number | bigint | string | null | undefined,
	decimals: number
): number {
	if (base == null) return 0;
	const n = typeof base === 'bigint' ? Number(base) : Number(base);
	if (!Number.isFinite(n)) return 0;
	return n / unitScale(decimals);
}

/**
 * A display number → base units, rounded to the nearest integer.
 *
 * Rounding, not truncation: `0.1 + 0.2` in binary floating point is
 * `0.30000000000000004`, and truncating that at 3 dp loses a milli-unit on an
 * amount the user typed exactly.
 */
export function toBaseUnits(display: number, decimals: number): number {
	if (!Number.isFinite(display)) return 0;
	return Math.round(display * unitScale(decimals));
}

/**
 * A user-typed amount string → base units, **truncating** extra decimals.
 *
 * Truncation is deliberate and different from `toBaseUnits`: the string comes
 * from a text field, so "0.1234" on a 3 dp asset means the user typed more
 * precision than exists. Rounding it up would spend a milli-unit they did not
 * enter. Parsing the digits also avoids float entirely — `Number('0.07') *
 * 1000` is `70.00000000000001`.
 *
 * Accepts an empty string, a bare integer, a leading sign and any number of
 * decimals. Anything unparseable is 0.
 */
export function parseAmountToBaseUnits(input: string, decimals: number): number {
	const s = (input ?? '').trim();
	if (s === '') return 0;
	const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
	if (!m) {
		// Not a plain decimal (exponent form, stray characters) — fall back to
		// float parsing rather than silently returning 0.
		const n = Number(s);
		return Number.isFinite(n) ? toBaseUnits(n, decimals) : 0;
	}
	const [, sign, intPart, fracPart = ''] = m;
	const frac = fracPart.slice(0, decimals).padEnd(decimals, '0');
	const digits = `${intPart || '0'}${frac}`;
	const value = Number.parseInt(digits, 10);
	if (!Number.isFinite(value)) return 0;
	return sign === '-' ? -value : value;
}

/**
 * Base units → the plain decimal string the UI puts in an input field.
 *
 * `keepTrailingZeroes` is what separates "12.3" (a value in a sentence) from
 * "12.300" (a value in a column that has to line up). Zero-decimal assets
 * (sats) never get a trailing dot, which an earlier version did emit.
 */
export function formatBaseUnits(
	base: number,
	decimals: number,
	keepTrailingZeroes = false
): string {
	const amount = Math.trunc(base);
	if (amount === 0 && !keepTrailingZeroes) return '0';
	const negative = amount < 0;
	const digits = Math.abs(amount).toString().padStart(decimals, '0');
	const split = digits.length - decimals;
	const integer = digits.slice(0, split);
	let decimal = digits.slice(split);
	if (!keepTrailingZeroes) decimal = decimal.replace(/0+$/, '');
	const sign = negative ? '-' : '';
	if (decimal.length === 0) return `${sign}${integer || '0'}`;
	return `${sign}${integer || '0'}.${decimal}`;
}

/**
 * Rescale base units from one asset's decimals to another's, multiplying by
 * `rate` on the way. This is the single cross-decimal conversion: 1 BTC
 * (8 dp) at 90,000 HBD/BTC becomes 90,000,000 milli-HBD (3 dp), and the
 * `10 ** (3 - 8)` is what gets that right.
 */
export function rescaleBaseUnits(
	base: number,
	rate: number,
	fromDecimals: number,
	toDecimals: number
): number {
	if (!Number.isFinite(base) || !Number.isFinite(rate)) return 0;
	return Math.round(base * rate * 10 ** (toDecimals - fromDecimals));
}

/** True when a raw amount field holds something we can actually send. */
export function isValidAmountString(s: string | undefined | null): boolean {
	if (!s) return false;
	const n = Number(s);
	return Number.isFinite(n) && n > 0;
}

/** Satoshis → BTC. */
export function satsToBtc(sats: number): number {
	return sats * 0.00000001;
}

/** BTC → satoshis, rounded (a fractional satoshi does not exist). */
export function btcToSats(btc: number): number {
	return Math.round(btc * 100_000_000);
}

// ═══════════════════════════════════════════════════════════════════════════
// §2  BASIS POINTS
//
// Fees and slippage are quoted on chain in basis points — hundredths of a
// percent — and shown to the reader as a percentage. Both directions, and the
// two ways a bps rate gets applied to an amount, live here. `ReviewSwap`,
// `Complete`, `swap.ts` and `walletRouterSwap.ts` each had their own copy of
// the same two expressions.
// ═══════════════════════════════════════════════════════════════════════════

export const BPS_PER_UNIT = 10_000;

/** 25 bps → 0.25 (percent). */
export function bpsToPct(bps: number): number {
	return bps / 100;
}

/** 0.25 (percent) → 25 bps, rounded; a slippage box only offers 2 decimals. */
export function pctToBps(pct: number): number {
	return Math.round(pct * 100);
}

/** The slice `bps` takes out of `amount`, rounded down (the chain floors). */
export function feeOfBps(amount: number, bps: number): number {
	if (!Number.isFinite(amount) || amount <= 0 || bps <= 0) return 0;
	return Math.floor((amount * bps) / BPS_PER_UNIT);
}

/** What is left of `amount` after a `bps` fee. Floors, like the contract. */
export function netAfterBps(amount: number, bps: number): number {
	if (!Number.isFinite(amount) || amount <= 0) return 0;
	if (bps <= 0) return Math.floor(amount);
	return Math.floor((amount * (BPS_PER_UNIT - bps)) / BPS_PER_UNIT);
}

/** `netAfterBps` for exact on-chain amounts. */
export function netAfterBpsBig(amount: bigint, bps: number): bigint {
	if (amount <= 0n) return 0n;
	if (bps <= 0) return amount;
	return (amount * BigInt(BPS_PER_UNIT - bps)) / BigInt(BPS_PER_UNIT);
}

/** Clamp a user-entered slippage percentage into what the form allows. */
/**
 * The highest slippage the swap card will accept.
 *
 * The clamp used to allow 99.99%, which is not a tolerance — it is consent to
 * receive almost nothing. Typing 250 silently became 99.99 and "Min received"
 * fell to 1/100th of the quote with nothing on screen to say so. 50% is still
 * far beyond any real swap and leaves the clamp as a backstop rather than a
 * setting.
 */
export const MAX_SLIPPAGE_PCT = 50;

/** Above this, the card warns. Normal swaps sit at 0.5–3%. */
export const SLIPPAGE_WARN_PCT = 5;

export function clampSlippagePct(pct: number, min = 0.01, max = MAX_SLIPPAGE_PCT): number {
	if (!Number.isFinite(pct)) return min;
	return Math.min(max, Math.max(min, pct));
}

// ═══════════════════════════════════════════════════════════════════════════
// §3  MONEY FORMATTING
//
// Five functions used to render a dollar amount and three of them disagreed
// about what to do below a cent. There are only three honest answers, so
// there are three functions: the reader's one, the axis-tick one, and the
// per-unit-price one for assets worth a fraction of a cent.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The dollar amount a reader reads: `$1,234.56`, always two decimals.
 *
 * Sub-cent values deliberately show `$0.00`. A column where one row reads
 * `$0.0007` and the next `$12.00` is harder to scan than one that admits the
 * row is worth nothing. For a PRICE per unit use `formatUsdPrice`.
 */
export function formatUsd(amount: number | undefined | null): string {
	if (amount == null || !Number.isFinite(amount)) return '$0.00';
	return new Intl.NumberFormat(NUMBER_LOCALE, {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

/**
 * A cost, where rounding to zero is a lie.
 *
 * `formatUsd` renders a fee of a third of a cent as "$0.00", so a quote that
 * charges a real fee read as free — and on a small swap those minimum fees are
 * the dominant cost, not a rounding error (L3: 10 HIVE → BTC loses 0.72% to
 * them). Exactly zero is still "$0.00", because then it IS free.
 */
export function formatUsdCost(amount: number | undefined | null): string {
	if (amount == null || !Number.isFinite(amount) || amount === 0) return formatUsd(amount);
	const abs = Math.abs(amount);
	if (abs < 0.01) return `${amount < 0 ? '-' : ''}< $0.01`;
	return formatUsd(amount);
}

/**
 * An exchange rate between two assets, e.g. "0.3356 HBD/HIVE".
 *
 * Pool rates were printed with `toFixed(8)` whatever their size, so a BTC
 * pair read "65006.26000000" — eight digits of noise on a number whose last
 * meaningful one is the cent — while a rate of 0.00001234 needs every one of
 * them. Scaled instead: big numbers get cents, small ones get four
 * significant digits.
 */
export function formatPriceRatio(value: number): string {
	if (!Number.isFinite(value)) return '-';
	const abs = Math.abs(value);
	if (abs === 0) return '0';
	if (abs >= 1000) return value.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 2 });
	if (abs >= 1) return value.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 4 });
	return value.toLocaleString(NUMBER_LOCALE, { maximumSignificantDigits: 4 });
}

/**
 * A per-unit price. Cents are enough for HIVE, HBD and BTC, but a custom
 * token can trade at $0.0007 — `formatUsd` renders that as `$0.00` and the
 * whole column reads as worthless — so below a cent this keeps three
 * significant digits instead.
 */
export function formatUsdPrice(value: number): string {
	if (!Number.isFinite(value)) return '$0.00';
	if (value > 0 && value < 0.01) {
		return `$${value.toLocaleString(NUMBER_LOCALE, { maximumSignificantDigits: 3 })}`;
	}
	return formatUsd(value);
}

/**
 * A short dollar form for chart axis ticks, where the label has a fixed
 * gutter. Thousands collapse to K, millions to M, and sub-dollar ticks keep
 * two significant digits — an axis reading "$0.00, $0.00, $0.00" is worse
 * than no axis.
 */
export function compactUsd(value: number): string {
	if (!Number.isFinite(value)) return '$0';
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	const round = (n: number) =>
		n.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: n >= 10 ? 0 : 1 });
	if (abs >= 1_000_000) return `${sign}$${round(abs / 1_000_000)}M`;
	if (abs >= 1_000) return `${sign}$${round(abs / 1_000)}K`;
	if (abs === 0) return '$0';
	if (abs >= 1) return `${sign}$${round(abs)}`;
	return `${sign}$${abs.toLocaleString(NUMBER_LOCALE, { maximumSignificantDigits: 2 })}`;
}

/**
 * The same collapse as `compactUsd`, without the currency — for a plain count
 * that has to fit a chip the layout cannot widen (resource credits in the top
 * bar, where the full figure is most of a phone's header).
 *
 * It keeps one decimal up to 100K (`13,463` → `13.5K`), because dropping to
 * `13K` loses the digit the number is actually read for. Below 1,000 nothing
 * is gained by collapsing, so the exact figure stays.
 */
export function compactCount(value: number): string {
	if (!Number.isFinite(value)) return '0';
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	const round = (n: number) =>
		n.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: n >= 100 ? 0 : 1 });
	if (abs >= 1_000_000) return `${sign}${round(abs / 1_000_000)}M`;
	if (abs >= 1_000) return `${sign}${round(abs / 1_000)}K`;
	return `${sign}${Math.round(abs).toLocaleString(NUMBER_LOCALE)}`;
}

/**
 * An asset amount with grouping and a fixed number of decimals:
 * `1,234.500 HIVE`. Pass `'$'` as the unit for a dollar column.
 */
export function formatAmountWithUnit(value: number, unit: string, decimals = 3): string {
	const safe = Number.isFinite(value) ? value : 0;
	const formatted = safe.toLocaleString(NUMBER_LOCALE, {
		useGrouping: true,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
	return unit === '$' ? `$${formatted}` : `${formatted} ${unit.toUpperCase()}`;
}

/**
 * An amount at exactly the asset's own precision, with thousands separators:
 * `1,234.500`. The form a balance is read in, where the decimals lining up
 * matters more than brevity.
 */
export function formatAmountGrouped(value: number, decimals: number): string {
	const safe = Number.isFinite(value) ? value : 0;
	return safe.toLocaleString(NUMBER_LOCALE, {
		useGrouping: true,
		minimumFractionDigits: decimals
	});
}

/**
 * An amount that keeps enough significant digits to say something, however
 * small it is — the readout under a swap field, where `0.000` is useless.
 *
 * Below 1 the significant-digit floor is capped at the asset's own decimals,
 * because asking for more significant digits than the asset has produces
 * trailing noise that is not real precision.
 */
export function formatMinFigs(
	value: number,
	decimals: number,
	figures = decimals + 1,
	minDecimals = decimals
): string {
	const safe = Number.isFinite(value) ? value : 0;
	const negative = safe < 0;
	const abs = Math.abs(safe);
	const minFigs = abs < 1 ? Math.min(decimals, figures) : figures;
	const formatted = abs.toLocaleString(NUMBER_LOCALE, {
		useGrouping: true,
		minimumSignificantDigits: Math.max(1, minFigs),
		minimumFractionDigits: minDecimals,
		maximumSignificantDigits: 21
	});
	return `${negative ? '-' : ''}${formatted}`;
}

/**
 * A dollar value split into its two type sizes, the way the balance card
 * draws it: big dollars, small cents.
 *
 * It rounds to cents FIRST and then splits. Splitting first renders $99.995
 * as "$99" + ".100" — the carry has nowhere to go.
 */
export function dollarsAndCents(value: number): { dollars: string; cents: string } {
	const safe = Number.isFinite(value) ? value : 0;
	const totalCents = Math.round(safe * 100);
	const negative = totalCents < 0;
	const abs = Math.abs(totalCents);
	const dollars = Math.floor(abs / 100);
	const cents = abs % 100;
	return {
		dollars: `${negative ? '-' : ''}${dollars.toLocaleString(NUMBER_LOCALE)}`,
		cents: cents.toString().padStart(2, '0')
	};
}

/** The USD value of an on-chain amount — the other half of every "≈ $" hint. */
export function usdOfBaseUnits(
	base: number | bigint | null | undefined,
	decimals: number,
	usdPerUnit: number
): number {
	if (!Number.isFinite(usdPerUnit)) return 0;
	return toDisplay(base, decimals) * usdPerUnit;
}

// ═══════════════════════════════════════════════════════════════════════════
// §4  EXCHANGE RATES
//
// The price feed quotes HIVE, HBD, USD, BTC and SATS against each other.
// Every Magi custom token is priced from its own pool against HBD, the DEX
// base asset — so a token rate composes through HBD in both directions. This
// is the arithmetic of that composition; fetching the feed and the pool
// reserves stays in `currency/convert.ts`.
// ═══════════════════════════════════════════════════════════════════════════

/** The five units the external price feed quotes directly. */
export const FEED_UNITS: readonly string[] = ['HIVE', 'HBD', 'USD', 'BTC', 'SATS'];

export function isFeedUnit(unit: string | undefined | null): boolean {
	return FEED_UNITS.includes((unit ?? '').toUpperCase());
}

/** The feed numbers the native cross-rate table is built from. */
export type FeedPrices = {
	hiveHbd: number;
	hiveUsd: number;
	hiveBtc: number;
	satsHive: number;
	hbdUsd: number;
	hbdBtc: number;
	satsHbd: number;
	btcUsd: number;
};

/**
 * Rates from one feed unit to all five, or null when `unit` is not one of
 * them. Every entry is "how many of the target you get for one of the base",
 * so a rate is always applied by multiplying.
 */
export function nativeRates(unit: string, p: FeedPrices): Record<string, number> | null {
	switch ((unit ?? '').toUpperCase()) {
		case 'HIVE':
			return { HIVE: 1, HBD: p.hiveHbd, USD: p.hiveUsd, BTC: p.hiveBtc, SATS: p.satsHive };
		case 'HBD':
			return { HIVE: 1 / p.hiveHbd, HBD: 1, USD: p.hbdUsd, BTC: p.hbdBtc, SATS: p.satsHbd };
		case 'USD':
			return {
				HIVE: 1 / p.hiveUsd,
				HBD: 1 / p.hbdUsd,
				USD: 1,
				BTC: 1 / p.btcUsd,
				SATS: satsToBtc(p.btcUsd)
			};
		case 'BTC':
			return {
				HIVE: 1 / p.hiveBtc,
				HBD: 1 / p.hbdBtc,
				USD: p.btcUsd,
				BTC: 1,
				SATS: btcToSats(1)
			};
		case 'SATS':
			return {
				HIVE: satsToBtc(1 / p.hiveBtc),
				HBD: satsToBtc(1 / p.hbdBtc),
				USD: satsToBtc(p.btcUsd),
				BTC: satsToBtc(1),
				SATS: 1
			};
		default:
			return null;
	}
}

/**
 * Rates from `unit` to everything quotable — the five feed units plus every
 * custom token with a pool — or null when `unit` itself cannot be priced.
 *
 *   from a feed unit:  tokens per unit = (HBD per unit) / (HBD per token)
 *   from a token:      X per token     = (HBD per token) × (X per HBD)
 *   token to token:    through HBD, exactly as the DEX routes it
 */
export function composeRates(
	unit: string,
	prices: FeedPrices,
	hbdPerToken: Record<string, number>
): Record<string, number> | null {
	const u = (unit ?? '').toUpperCase();
	const native = nativeRates(u, prices);

	if (native) {
		const out: Record<string, number> = { ...native };
		for (const [token, hbd] of Object.entries(hbdPerToken)) {
			if (hbd > 0) out[token] = native.HBD / hbd;
		}
		return out;
	}

	const mine = hbdPerToken[u];
	if (!mine || mine <= 0) return null;
	const hbdRates = nativeRates('HBD', prices);
	if (!hbdRates) return null;

	const out: Record<string, number> = {};
	for (const [target, perHbd] of Object.entries(hbdRates)) out[target] = mine * perHbd;
	for (const [token, hbd] of Object.entries(hbdPerToken)) {
		if (hbd > 0) out[token] = mine / hbd;
	}
	return out;
}

/**
 * HBD per token from a token/HBD pool's reserves. Both reserves arrive in
 * base units with their own decimals, which is why this cannot be a plain
 * division — LASSECASH is 8 dp against HBD's 3.
 */
export function hbdPerTokenFromReserves(
	tokenReserve: number | bigint,
	tokenDecimals: number,
	hbdReserve: number | bigint,
	hbdDecimals = 3
): number {
	const tokens = toDisplay(tokenReserve, tokenDecimals);
	const hbd = toDisplay(hbdReserve, hbdDecimals);
	if (tokens <= 0 || hbd <= 0) return 0;
	return hbd / tokens;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5  SWAP / AMM
//
// The constant-product pool, its two fee legs, the slippage floor and the
// price impact. This mirrors the on-chain contract and is the part of the
// file where a wrong digit costs real money, so every quantity here is a
// `bigint` in base units and nothing is allowed to touch floating point.
//
// ⚠️ The three constants below mirror go-vsc-node. If an on-chain value
//    changes, change it here in the same PR.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hard cap on the pendulum stabilizer multiplier `m`, in bps. 20000 = m 2.0.
 * Mirrors `DefaultStabilizerParamsBps.Cap` in
 * go-vsc-node/modules/incentive-pendulum/fees_int.go.
 */
export const STABILIZER_CAP_BPS = 20000n;
export const BPS_SCALE = 10000n;

/**
 * Constant scale on the CLP fee leg (no stabilizer), in bps. 625 = 1/16.
 * Mirrors `Config.CLPScaleBps` in incentive-pendulum/wasm/applier.go. Added
 * by the 2026-06-19 fee fix: the pendulum multiplier came OFF the CLP leg and
 * this constant went on, so large swaps are no longer charged ≈2× their
 * price impact.
 */
export const CLP_SCALE_BPS = 625n;

/** The protocol fee tier, in bps of gross output. */
export const PROTOCOL_FEE_BPS = 8n;

/**
 * Which swap-fee rule the node charges (`ConsensusParams.PendulumSlipParityHeight`):
 *  - 'off':  today's rule — protocol tier (8 bps × m) + the slip fee × 1/16.
 *  - 'on':   THORChain's rule — the larger of the full slip fee and the tier.
 *  - 'both': across the activation height, quote the higher of the two so
 *            `min_amount_out` holds under whichever rule the swap meets.
 */
export type SlipFeeRule = 'off' | 'both' | 'on';
export const SLIP_FEE_RULE: SlipFeeRule = 'off';

/** Pool reserves with explicit asset ordering, so one struct covers any pair. */
export interface TypedPoolDepths {
	contractId: string;
	/** Lowercase asset name — "hive", "hbd", "btc". */
	asset0: string;
	asset1: string;
	reserve0: bigint;
	reserve1: bigint;
}

/** Legacy two-asset shape: reserve0 = HIVE, reserve1 = HBD. */
export interface PoolDepths {
	reserve0: bigint;
	reserve1: bigint;
}

export type PoolDepthMap = Record<string, TypedPoolDepths>;

/** One leg of a swap. Asset names are lowercase. */
export type SwapHop = {
	pool: TypedPoolDepths;
	assetIn: string;
	assetOut: string;
};

export interface SwapCalcResult {
	baseFee: bigint;
	clpFee: bigint;
	totalFee: bigint;
	expectedOutput: bigint;
	minAmountOut: bigint;
	/** Basis points — 100 = 1%. */
	slippageBps: number;
	/** Modelled effective fee as a fraction of gross output, in bps. Drives
	 *  the overcharge guard. A two-hop swap sums both hops. */
	feeBps: number;
	/** Two-hop only: hop 1 takes its fees in the intermediate asset. */
	hop1Fee?: {
		asset: string;
		baseFee: bigint;
		clpFee: bigint;
		totalFee: bigint;
	};
}

/**
 * Swap-fee safety guard. The on-chain CLP fee can charge far above the 8 bps
 * tier, so a swap whose MODELLED fee exceeds this is blocked client-side
 * rather than silently overcharged. 300 bps lets small and moderate swaps
 * through while catching the clearly-broken cases.
 */
export const SWAP_FEE_GUARD_BPS = 300;

/**
 * Under the parity rule the slip fee is the trade's own price impact, honestly
 * charged, so 3% would only mean "this trade is 3% of the pool". The backstop
 * moves to 10% and only catches a quote that is plainly wrong.
 */
export const SWAP_FEE_GUARD_PARITY_BPS = 1000;

/** True when a modelled swap fee is above the safety threshold. */
export function swapFeeExceedsGuard(
	feeBps: number | undefined | null,
	rule: SlipFeeRule = SLIP_FEE_RULE
): boolean {
	const limit = rule === 'off' ? SWAP_FEE_GUARD_BPS : SWAP_FEE_GUARD_PARITY_BPS;
	return feeBps != null && feeBps > limit;
}

/** The one wording of the guard message. */
export function swapFeeGuardMessage(feeBps: number | undefined | null): string {
	const pct = feeBps != null ? bpsToPct(feeBps).toFixed(1) : '?';
	return (
		`Swap cancelled to protect you: the network would currently charge an abnormally high fee ` +
		`(~${pct}%, well above the usual ~0.1%) on this trade. Try a smaller amount, or wait until ` +
		`this is resolved.`
	);
}

/** Effective fee in bps = totalFee / grossOut, where grossOut = out + fee. */
export function feeBpsOf(totalFee: bigint, expectedOutput: bigint): number {
	const grossOut = expectedOutput + totalFee;
	if (grossOut <= 0n) return 0;
	return Number((totalFee * 10000n) / grossOut);
}

/** The constant-product output before any fee: `Y - (X·Y)/(X+x)`. */
export function constantProductOut(x: bigint, X: bigint, Y: bigint): bigint {
	if (x <= 0n || X <= 0n || Y <= 0n) return 0n;
	return Y - (X * Y) / (X + x);
}

/** An empty quote, for a route that cannot be priced. */
export function emptySwapResult(slippageBps: number): SwapCalcResult {
	return {
		baseFee: 0n,
		clpFee: 0n,
		totalFee: 0n,
		expectedOutput: 0n,
		minAmountOut: 0n,
		slippageBps,
		feeBps: 0
	};
}

/**
 * Quote one hop.
 *
 * @param x            Input amount, base units of the input asset
 * @param X            Reserve of the input asset
 * @param Y            Reserve of the output asset
 * @param slippageBps  Tolerance in bps. It now only has to absorb normal AMM
 *                     reserve drift between signing and execution — the
 *                     stabilizer surplus is already inside `expectedOutput`.
 */
export function calculateSwap(
	x: bigint,
	X: bigint,
	Y: bigint,
	slippageBps: number,
	rule: SlipFeeRule = SLIP_FEE_RULE
): SwapCalcResult {
	if (x <= 0n || X <= 0n || Y <= 0n) return emptySwapResult(slippageBps);

	const newX = X + x;
	const grossOut = Y - (X * Y) / newX;

	// Base fees at m = 1, mirroring the contract (each floors at 1 sub-unit):
	//   protocol = grossOut · 8 / 10000
	//   CLP      = x²·Y / (x+X)²
	let baseProtocolFee = (grossOut * PROTOCOL_FEE_BPS) / BPS_SCALE;
	if (baseProtocolFee === 0n) baseProtocolFee = 1n;

	let baseClpFee = (x * x * Y) / (newX * newX);
	if (baseClpFee === 0n) baseClpFee = 1n;

	// The protocol leg carries the stabilizer; we quote the worst case
	// (m = 2.0 at the cap) so `expectedOutput` is a guaranteed FLOOR for any
	// real m ∈ [1,2] and the contract's `actualOutput ≥ min_amount_out` gate
	// always passes. The CLP leg carries the constant scale instead.
	const chargedProtocolFee = (baseProtocolFee * STABILIZER_CAP_BPS) / BPS_SCALE;
	const scaledClpFee = (baseClpFee * CLP_SCALE_BPS) / BPS_SCALE;
	// Parity rule: the total is max(full slip fee, protocol tier), so the CLP
	// leg carries only what the slip fee adds above the tier.
	const parityClpFee = baseClpFee > chargedProtocolFee ? baseClpFee - chargedProtocolFee : 0n;
	const chargedClpFee =
		rule === 'off'
			? scaledClpFee
			: rule === 'on'
				? parityClpFee
				: parityClpFee > scaledClpFee
					? parityClpFee
					: scaledClpFee;
	const totalFee = chargedProtocolFee + chargedClpFee;

	let expectedOutput = grossOut - totalFee;
	if (expectedOutput < 0n) expectedOutput = 0n;

	const slipBps = BigInt(Math.max(0, Math.min(slippageBps, 10000)));
	const minAmountOut = (expectedOutput * (BPS_SCALE - slipBps)) / BPS_SCALE;

	// `feeBps` drives the overcharge guard and is computed from the STRUCTURAL
	// (un-floored) fee, not `totalFee`. The "floor 1" minimums above are a
	// fixed sub-unit cost, not the percentage-scaling overcharge the guard
	// exists to catch, and on dust trades they dominate: a 1-unit protocol
	// floor × the 2× stabilizer on a ~20-unit gross output reads as ~10% and
	// would wrongly BLOCK an economically negligible swap. `totalFee` and
	// `expectedOutput` keep the floored values so the quote stays honest about
	// what is actually charged.
	const structuralProtocol =
		((grossOut * PROTOCOL_FEE_BPS) / BPS_SCALE) * (STABILIZER_CAP_BPS / BPS_SCALE);
	const structuralClp = (x * x * Y) / (newX * newX);
	const structuralScaled = structuralProtocol + (structuralClp * CLP_SCALE_BPS) / BPS_SCALE;
	const structuralParity = structuralClp > structuralProtocol ? structuralClp : structuralProtocol;
	const structuralFee =
		rule === 'off'
			? structuralScaled
			: rule === 'on'
				? structuralParity
				: structuralParity > structuralScaled
					? structuralParity
					: structuralScaled;

	return {
		baseFee: chargedProtocolFee,
		clpFee: chargedClpFee,
		totalFee,
		expectedOutput,
		minAmountOut,
		slippageBps,
		feeBps: feeBpsOf(structuralFee, grossOut - structuralFee)
	};
}

/** Order the legacy HIVE/HBD reserves by which asset is going in. */
export function getOrderedDepths(
	depths: PoolDepths,
	assetIn: 'hive' | 'hbd'
): { X: bigint; Y: bigint } {
	return assetIn === 'hive'
		? { X: depths.reserve0, Y: depths.reserve1 }
		: { X: depths.reserve1, Y: depths.reserve0 };
}

/** Order any pool's reserves by which asset is going in, or null if the pool
 *  does not hold that asset. */
export function getOrderedDepthsFor(
	pool: TypedPoolDepths,
	assetIn: string
): { X: bigint; Y: bigint } | null {
	const a = assetIn?.toLowerCase();
	if (pool.asset0 === a) return { X: pool.reserve0, Y: pool.reserve1 };
	if (pool.asset1 === a) return { X: pool.reserve1, Y: pool.reserve0 };
	return null;
}

/**
 * Two hops: input → `hopAsset` in pool1 → output in pool2.
 *
 * Slippage applies only to the FINAL output, matching the router: each hop
 * runs at live price and the guard fires on the receive amount.
 */
export function calculateTwoHopSwap(
	x: bigint,
	pool1: TypedPoolDepths,
	pool2: TypedPoolDepths,
	assetIn: string,
	hopAsset: string,
	assetOut: string,
	slippageBps: number,
	rule: SlipFeeRule = SLIP_FEE_RULE
): SwapCalcResult {
	const hop1Depths = getOrderedDepthsFor(pool1, assetIn);
	if (!hop1Depths) return emptySwapResult(slippageBps);

	const hop1 = calculateSwap(x, hop1Depths.X, hop1Depths.Y, 0, rule);
	const hop1Fee = {
		asset: hopAsset,
		baseFee: hop1.baseFee,
		clpFee: hop1.clpFee,
		totalFee: hop1.totalFee
	};
	if (hop1.expectedOutput <= 0n) return { ...hop1, slippageBps, hop1Fee };

	const hop2Depths = getOrderedDepthsFor(pool2, hopAsset);
	if (!hop2Depths) return { ...emptySwapResult(slippageBps), feeBps: hop1.feeBps, hop1Fee };

	const hop2 = calculateSwap(hop1.expectedOutput, hop2Depths.X, hop2Depths.Y, slippageBps, rule);

	// Fees are output-denominated per hop: hop1's are in `hopAsset`, hop2's in
	// `assetOut`. The top-level fields hold hop2; `hop1Fee` carries hop1 so a
	// caller can render "<hop1Total> <hopAsset> and <hop2Total> <assetOut>".
	return {
		baseFee: hop2.baseFee,
		clpFee: hop2.clpFee,
		totalFee: hop2.totalFee,
		expectedOutput: hop2.expectedOutput,
		minAmountOut: hop2.minAmountOut,
		slippageBps,
		// Both hops are taxed, so the effective cost compounds.
		feeBps: hop1.feeBps + hop2.feeBps,
		hop1Fee
	};
}

/** HBD is the DEX's base asset — every pool pairs against it, so any two
 *  assets either share a pool or route through HBD in two hops. */
export const DEX_BASE_ASSET = 'hbd';

/**
 * Build a route from pools already in hand. `findPool(a, b)` returns the pool
 * for that unordered pair or null. Null means no route: same asset, or a
 * missing pool on a leg.
 */
export function buildSwapRoute(
	assetIn: string,
	assetOut: string,
	findPool: (a: string, b: string) => TypedPoolDepths | null
): SwapHop[] | null {
	const aIn = assetIn?.toLowerCase();
	const aOut = assetOut?.toLowerCase();
	if (!aIn || !aOut || aIn === aOut) return null;

	const direct = findPool(aIn, aOut);
	if (direct) return [{ pool: direct, assetIn: aIn, assetOut: aOut }];

	// A pair already involving the base asset has nowhere left to hop, so it
	// is untradeable rather than a two-hop route.
	if (aIn === DEX_BASE_ASSET || aOut === DEX_BASE_ASSET) return null;

	const first = findPool(aIn, DEX_BASE_ASSET);
	const second = findPool(DEX_BASE_ASSET, aOut);
	if (!first || !second) return null;
	return [
		{ pool: first, assetIn: aIn, assetOut: DEX_BASE_ASSET },
		{ pool: second, assetIn: DEX_BASE_ASSET, assetOut: aOut }
	];
}

/**
 * Price impact across a whole route, in percent. Impacts compound:
 * `combined = 1 - Π(1 - impact_hop)`. Each hop is sized from the previous
 * hop's GROSS (pre-fee) output.
 */
export function priceImpactForRoute(x: bigint, route: SwapHop[] | null): number {
	if (x <= 0n || !route || route.length === 0) return 0;
	let amount = x;
	let survival = 1;
	for (let i = 0; i < route.length; i++) {
		const hop = route[i];
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d || d.X <= 0n) return 0;
		survival *= 1 - Number(amount) / Number(d.X + amount);
		// Only size the NEXT hop. Carrying this past the last hop runs a
		// BigInt division that floors to 0 for a small trade against a
		// low-decimal reserve, which then reads as "no impact".
		if (i === route.length - 1) break;
		amount = (amount * d.Y) / (d.X + amount);
		if (amount <= 0n) return 0;
	}
	return (1 - survival) * 100;
}

/**
 * True when the trade would be rejected on chain for taking more than half of
 * an input-side reserve on any hop. Later hops are sized from the previous
 * hop's NET output, since that is what actually reaches the pool.
 */
export function exceedsPoolDepthForRoute(x: bigint, route: SwapHop[] | null): boolean {
	if (x <= 0n || !route || route.length === 0) return false;
	let amount = x;
	for (let i = 0; i < route.length; i++) {
		const hop = route[i];
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d) return false;
		if (amount * 2n > d.X) return true;
		if (i === route.length - 1) break;
		amount = calculateSwap(amount, d.X, d.Y, 0).expectedOutput;
		if (amount <= 0n) return false;
	}
	return false;
}

/** Quote a swap over a resolved route — one entry point instead of choosing
 *  between the one-hop and two-hop functions by hand. */
export function calculateRouteSwap(
	x: bigint,
	route: SwapHop[] | null,
	slippageBps: number
): SwapCalcResult {
	if (!route || route.length === 0) return emptySwapResult(slippageBps);

	if (route.length === 1) {
		const [hop] = route;
		const d = getOrderedDepthsFor(hop.pool, hop.assetIn);
		if (!d) return emptySwapResult(slippageBps);
		return calculateSwap(x, d.X, d.Y, slippageBps);
	}

	const [hop1, hop2] = route;
	return calculateTwoHopSwap(
		x,
		hop1.pool,
		hop2.pool,
		hop1.assetIn,
		hop1.assetOut,
		hop2.assetOut,
		slippageBps
	);
}

/**
 * The effective rate a quote works out to: output units per 1 input unit.
 * Derived from the quote rather than from the pool so it reflects the fee and
 * the impact the user is actually paying.
 */
export function effectiveRate(
	inputBase: number | bigint,
	outputBase: number | bigint,
	inputDecimals: number,
	outputDecimals: number
): number {
	const inp = toDisplay(inputBase, inputDecimals);
	const out = toDisplay(outputBase, outputDecimals);
	if (inp <= 0) return 0;
	return out / inp;
}

/**
 * The USD cost of a quote's protocol fees, both hops included.
 *
 * `QuickSwap` and `SwapOptions` carried byte-identical copies of this, each
 * reaching into `baseFee` and `hop1Fee.baseFee` with its own decimals lookup.
 */
export function protocolFeeUsd(
	result: Pick<SwapCalcResult, 'baseFee' | 'hop1Fee'> | null | undefined,
	outDecimals: number,
	outUsdPerUnit: number,
	hop1Decimals?: number,
	hop1UsdPerUnit?: number
): number {
	if (!result) return 0;
	let usd = usdOfBaseUnits(result.baseFee, outDecimals, outUsdPerUnit);
	if (result.hop1Fee && hop1Decimals != null && hop1UsdPerUnit != null) {
		usd += usdOfBaseUnits(result.hop1Fee.baseFee, hop1Decimals, hop1UsdPerUnit);
	}
	return usd;
}

/** How severe a price impact is, for the colour and the warning. */
export type ImpactLevel = 'none' | 'low' | 'medium' | 'high' | 'severe';

export function impactLevel(pct: number): ImpactLevel {
	if (!Number.isFinite(pct) || pct <= 0) return 'none';
	if (pct < 1) return 'low';
	if (pct < 3) return 'medium';
	if (pct < 5) return 'high';
	return 'severe';
}

// ═══════════════════════════════════════════════════════════════════════════
// §6  POOLS AND LP
// ═══════════════════════════════════════════════════════════════════════════

/** A position's share of a pool, as a fraction of 1. */
export function lpShare(lpBalance: number, totalLp: number): number {
	if (!(totalLp > 0) || !Number.isFinite(lpBalance)) return 0;
	return lpBalance / totalLp;
}

/**
 * What a position is worth in the two pool assets, in display units.
 *
 * The same pro-rata formula backs the Pools table, the Remove-liquidity
 * estimate and the LP revenue replay; all three used to spell it out.
 */
export function lpPositionAmounts(
	share: number,
	reserve0Base: number,
	reserve1Base: number,
	decimals0: number,
	decimals1: number
): [number, number] {
	return [toDisplay(reserve0Base * share, decimals0), toDisplay(reserve1Base * share, decimals1)];
}

/** The USD value of a two-sided position. */
export function lpPositionUsd(
	amounts: [number, number],
	usdPrice0: number,
	usdPrice1: number
): number {
	return amounts[0] * usdPrice0 + amounts[1] * usdPrice1;
}

/**
 * The other side of a liquidity add, at the pool's current ratio.
 *
 * An empty pool has no ratio, so it falls back to the USD prices — which is
 * what sets the opening price of a brand new pool.
 */
export function mirrorLiquidityAmount(
	amountIn: number,
	reserveInDisplay: number,
	reserveOutDisplay: number,
	usdIn = 0,
	usdOut = 0
): number {
	if (!Number.isFinite(amountIn) || amountIn <= 0) return 0;
	if (reserveInDisplay > 0 && reserveOutDisplay > 0) {
		return amountIn * (reserveOutDisplay / reserveInDisplay);
	}
	if (usdIn > 0 && usdOut > 0) return amountIn * (usdIn / usdOut);
	return 0;
}

/** The price of asset0 in asset1 and back, from reserves in display units. */
export function poolPriceRatio(
	reserve0: number | null,
	reserve1: number | null,
	usd0 = 0,
	usd1 = 0
): { ratio: number | null; inverse: number | null } {
	const haveReserves = reserve0 != null && reserve1 != null && reserve0 !== 0 && reserve1 !== 0;
	if (haveReserves) return { ratio: reserve1 / reserve0, inverse: reserve0 / reserve1 };
	if (usd0 > 0 && usd1 > 0) return { ratio: usd0 / usd1, inverse: usd1 / usd0 };
	return { ratio: null, inverse: null };
}

/**
 * Price an asset the feed does not quote from the pool it trades in.
 *
 * Without this a custom token's liquidity side and every fee collected in it
 * counted as $0 — HBD:LASSECASH showed "$0.00" fees after earning 117
 * LASSECASH in its first four swaps.
 */
export function impliedPoolUsdPrices(
	usd0: number,
	usd1: number,
	reserve0: number,
	reserve1: number
): [number, number] {
	if (!(reserve0 > 0) || !(reserve1 > 0)) return [usd0, usd1];
	if (usd0 === 0 && usd1 > 0) return [(usd1 * reserve1) / reserve0, usd1];
	if (usd1 === 0 && usd0 > 0) return [usd0, (usd0 * reserve0) / reserve1];
	return [usd0, usd1];
}

/** Total value locked, both sides at their USD prices. */
export function poolTvlUsd(amount0: number, amount1: number, usd0: number, usd1: number): number {
	return amount0 * usd0 + amount1 * usd1;
}

// ═══════════════════════════════════════════════════════════════════════════
// §7  RESOURCE CREDITS
//
// RC is the account's Magi-ledger HBD in milli-units plus a free allowance,
// so a shortfall of N RC is N/1000 HBD to deposit. The node gives a call
// `min(available, rc_limit)` gas and charges only what it uses, so the limit
// is a cap, not a price.
// ═══════════════════════════════════════════════════════════════════════════

/** The node rejects `rc_limit` outside [1, 100000] (schema.resolvers.go). */
export const MAX_RC_LIMIT = 100_000;

/** Headroom over a simulated cost: chain state can move between the dry run
 *  and block inclusion. Same factor the VSC explorer uses. */
export const RC_MARGIN = 1.25;

/**
 * The least a swap paid out to a BTC address costs. Measured with dry runs on
 * the mainnet contracts on 2026-11-05: 11,686 RC for HBD→BTC and 12,007 for
 * HIVE→HBD→BTC, one vault input each.
 */
export const BTC_PAYOUT_SWAP_MIN_RC = 11_700;

/** The free RC allowance a Hive account gets before its HBD counts. */
export const FREE_RC_ALLOWANCE = 10_000;

export type InsufficientRc = {
	ok: false;
	reason: 'insufficient-rc';
	/** The exact cost when the dry run completed; absent when it ran out of
	 *  RC first, in which case all we know is "more than `available`". */
	needed?: number;
	available: number;
};

export type RcSizing = { ok: true; rcLimit: number } | InsufficientRc;

/**
 * Pick the broadcast `rc_limit` for a call measured at `rcUsed`: the measured
 * cost plus margin when the account can afford it, otherwise everything it
 * has — as long as that still covers the measured cost. Below that the call
 * is certain to fail, so report it instead of burning the RC.
 */
export function sizeRcLimit(rcUsed: number, available: number): RcSizing {
	const cap = Math.min(Math.floor(available), MAX_RC_LIMIT);
	if (rcUsed > cap) {
		return {
			ok: false,
			reason: 'insufficient-rc',
			needed: rcUsed,
			available: Math.floor(available)
		};
	}
	const padded = Math.ceil(rcUsed * RC_MARGIN);
	return { ok: true, rcLimit: Math.max(1, Math.min(padded, cap)) };
}

/**
 * The `rc_limit` for a swap paid out to a BTC address.
 *
 * `hbdPulledFromMagi` is the swap input when it is HBD already on the Magi
 * ledger. The node reserves (rc_limit − free RC) of the caller's HBD against
 * RC before an HBD intent pull, so the limit has to leave the input amount
 * spendable or the swap fails "insufficient balance".
 */
export function btcPayoutSwapRcLimit(available: number, hbdPulledFromMagi: number): RcSizing {
	const spendable = Math.floor(available - Math.max(0, hbdPulledFromMagi));
	const cap = Math.min(spendable, MAX_RC_LIMIT);
	if (cap < BTC_PAYOUT_SWAP_MIN_RC) {
		return {
			ok: false,
			reason: 'insufficient-rc',
			needed: BTC_PAYOUT_SWAP_MIN_RC,
			available: Math.max(0, spendable)
		};
	}
	return { ok: true, rcLimit: cap };
}

/** RC → the HBD deposit that would cover it, rounded up to the cent. */
export function rcShortfallToHbd(needed: number, available: number): number {
	return Math.ceil(Math.max(0, needed - available) / 10) / 100;
}

/**
 * The account's RC ceiling: its Magi-ledger HBD, plus the free allowance for
 * a Hive account. Both sides are in milli-units.
 */
export function maxRc(hbdMilli: number, hasFreeAllowance: boolean): number {
	return hbdMilli + (hasFreeAllowance ? FREE_RC_ALLOWANCE : 0);
}

/** How full the RC bar is, 0–100, floored so it never reads 100 while short. */
export function rcPercent(rc: number, max: number): number {
	if (!(max > 0)) return 0;
	return Math.min(100, Math.floor((Math.max(rc, 0) / max) * 100));
}

// ═══════════════════════════════════════════════════════════════════════════
// §8  STAKING AND INTEREST
// ═══════════════════════════════════════════════════════════════════════════

/** The Hive chain quotes its HBD interest rate in bps; the UI shows whole %. */
export function hbdAprFromChainRate(rateBps: number | null | undefined, fallback = 12): number {
	if (rateBps == null || !Number.isFinite(rateBps)) return fallback;
	return Math.round(rateBps / 100);
}

/**
 * What a staked balance earns over a period, simple interest at `aprPct`.
 *
 * sHBD interest is the gateway's L1 HBD-savings interest and is distributed
 * when the gateway receives it (~every 30 days), so these are estimates of an
 * accrual, not of a payout date.
 */
export function interestOverPeriod(
	balance: number,
	aprPct: number,
	periodsPerYear: number
): number {
	if (!Number.isFinite(balance) || !Number.isFinite(aprPct) || !(periodsPerYear > 0)) return 0;
	return (balance * (aprPct / 100)) / periodsPerYear;
}

/** Daily and monthly accrual on a staked balance. */
export function stakingEarnings(
	balance: number,
	aprPct: number
): { daily: number; monthly: number; yearly: number } {
	return {
		daily: interestOverPeriod(balance, aprPct, 365),
		monthly: interestOverPeriod(balance, aprPct, 12),
		yearly: interestOverPeriod(balance, aprPct, 1)
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// §9  CHARTS
//
// Zoom and pan are a WINDOW over points that have already been fetched, never
// a new query: the range dropdown decides what is loaded, this decides how
// much of it is on screen. `null` means "all of it", kept distinct from
// `{s: 0, e: n}` so a fresh fetch can drop the window by assignment instead
// of re-clamping indices against a different number of points.
// ═══════════════════════════════════════════════════════════════════════════

export type ChartWindow = { s: number; e: number } | null;

/** Fewer points than this on screen stops being a chart. */
export const MIN_POINTS = 4;

/** The window actually in effect, with `null` resolved against the data. */
export function resolveWindow(win: ChartWindow, pointCount: number): { s: number; e: number } {
	return win ?? { s: 0, e: pointCount };
}

/**
 * Pin a window inside the data and no narrower than `MIN_POINTS`.
 *
 * At an edge it SLIDES rather than shrinking: panning past the end keeps the
 * span and stops, instead of squeezing against the boundary and silently
 * zooming in.
 */
export function clampWindow(
	start: number,
	end: number,
	pointCount: number
): { s: number; e: number } {
	if (pointCount <= MIN_POINTS) return { s: 0, e: Math.max(0, pointCount) };
	const span = Math.min(pointCount, Math.max(MIN_POINTS, Math.round(end - start)));
	let s = Math.round(start);
	if (s < 0) s = 0;
	if (s + span > pointCount) s = pointCount - span;
	return { s, e: s + span };
}

/**
 * Zoom about the middle of what is on screen; `factor` below 1 zooms in.
 * Returns `null` once the window covers everything, so "zoomed out fully" and
 * "never zoomed" are the same state and the reset control disables itself.
 */
export function zoomWindow(win: ChartWindow, factor: number, pointCount: number): ChartWindow {
	const { s, e } = resolveWindow(win, pointCount);
	const mid = (s + e) / 2;
	const span = (e - s) * factor;
	const next = clampWindow(mid - span / 2, mid + span / 2, pointCount);
	return next.s === 0 && next.e === pointCount ? null : next;
}

/** Move by a fraction of the visible span; negative goes back in time. */
export function panWindow(win: ChartWindow, fraction: number, pointCount: number): ChartWindow {
	const { s, e } = resolveWindow(win, pointCount);
	const step = (e - s) * fraction;
	return clampWindow(s + step, e + step, pointCount);
}

/**
 * Which data point a pointer at `clientX` is over, or null when there is
 * nothing to point at.
 *
 * Point `i` is drawn at `xScale(date) ∈ [marginLeft, width - marginRight]`, so
 * the pointer is measured from the START of that range and divided by the
 * spacing between points. The `- marginLeft` is load-bearing: it shipped once
 * as `+ marginLeft`, which was invisible for as long as every chart had a
 * zero-width left gutter and put the crosshair 2·gutter/chunk points to the
 * right of the pointer the moment a y axis gave one a gutter.
 */
export function pointerIndex(
	clientX: number,
	boxLeft: number,
	marginLeft: number,
	chunkSize: number,
	lastIndex: number
): number | null {
	if (lastIndex < 0) return null;
	const index = Math.round((clientX - boxLeft - marginLeft) / chunkSize);
	if (!Number.isFinite(index)) return null;
	if (index < 0) return 0;
	if (index > lastIndex) return lastIndex;
	return index;
}

/** A running total over a series of signed deltas — a balance replayed from
 *  its movements. */
export function runningTotal(deltas: number[]): number[] {
	let sum = 0;
	return deltas.map((d) => (sum += Number.isFinite(d) ? d : 0));
}

/** Percentage change from `from` to `to`; 0 when `from` is 0. */
export function percentChange(from: number, to: number): number {
	if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
	return ((to - from) / Math.abs(from)) * 100;
}

/** Axis ticks spread evenly over `count` slots, half a step in from each end. */
export function spacedIndexes(total: number, count: number): number[] {
	if (!(total > 0) || !(count > 0)) return [];
	const per = total / count;
	return Array.from({ length: count }, (_, i) => Math.floor(per * i + per / 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// §10  BITCOIN FEES AND SPENDABLE
// ═══════════════════════════════════════════════════════════════════════════

/** A BTC send is budgeted at this many virtual bytes. */
export const BTC_SEND_FEE_VBYTES = 200;
/** Used when the chain's fee rate cannot be read. */
export const BTC_FALLBACK_FEE_RATE = 10;

/** Confirmed sats minus what is already on its way out. */
export function spendableSats(confirmed: number, pendingOut: number): number {
	return Math.max(0, confirmed - pendingOut);
}

/** Sats to hold back so the send can pay its own miner fee. */
export function feeReserveSats(feeRate: number, vbytes = BTC_SEND_FEE_VBYTES): number {
	return Math.ceil(Math.max(0, feeRate) * vbytes);
}

/** The most that can actually leave, fee reserve included. */
export function maxSendableSats(spendable: number, reserve: number): number {
	return Math.max(0, spendable - reserve);
}

/*
 * `clampedFeeRate` and `estimateVSize` used to live here as well.
 *
 * They were dead copies: the live ones are module-private in
 * `magiTransactions/bitcoin/btcFeeEstimate.ts` and nothing imported these.
 * Worse, they had drifted — this `clampedFeeRate` rounded and the live one
 * does not, and this `estimateVSize` took the TOTAL byte count as its second
 * argument while the live one takes the witness bytes only. Same names, same
 * shape, different meaning: whichever one the next edit reached for, half the
 * time it would have been the wrong one.
 */

// ═══════════════════════════════════════════════════════════════════════════
// §11  BLOCK HEIGHTS AND TIME
//
// Hive produces a block every 3 seconds, which is how a height becomes a date
// and back. Both directions take the reference point as an argument so they
// stay pure.
// ═══════════════════════════════════════════════════════════════════════════

export const BLOCK_SECONDS = 3;

/** The wall-clock time of a block, relative to a known height and time. */
export function dateFromBlockHeight(
	height: number,
	syncHeight: number,
	syncTimeMs: number
): number {
	return syncTimeMs + (height - syncHeight) * BLOCK_SECONDS * 1000;
}

/** The block height at a given time, relative to the same reference. */
export function blockHeightFromDate(
	timeMs: number,
	syncHeight: number,
	syncTimeMs: number
): number {
	return syncHeight + Math.floor((timeMs - syncTimeMs) / 1000 / BLOCK_SECONDS);
}

/** Seconds left until `targetMs`, never negative. */
export function secondsRemaining(targetMs: number, nowMs: number): number {
	return Math.max(0, Math.floor((targetMs - nowMs) / 1000));
}

/** Seconds split into the units a countdown shows. */
export function splitDuration(totalSeconds: number): {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
} {
	const s = Math.max(0, Math.floor(totalSeconds));
	return {
		days: Math.floor(s / 86400),
		hours: Math.floor((s % 86400) / 3600),
		minutes: Math.floor((s % 3600) / 60),
		seconds: s % 60
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// §12  SMALL NUMERIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Keep a number inside a range. */
export function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

/** How far along something is, 0–100. */
export function progressPercent(value: number, max: number, min = 0): number {
	if (!(max > 0)) return 0;
	return Math.floor((Math.max(value, min) / max) * 100);
}

/** Round to `sigFigs` significant digits. */
export function roundToSigFigs(n: number, sigFigs: number): number {
	if (!Number.isFinite(n) || n === 0) return 0;
	const magnitude = Math.floor(Math.log10(Math.abs(n)));
	const factor = 10 ** (sigFigs - 1 - magnitude);
	return Math.round(n * factor) / factor;
}

/** The delay before retry number `attempt` (0-based), doubling each time. */
export function backoffDelayMs(attempt: number, baseMs = 1000): number {
	return baseMs * 2 ** Math.max(0, attempt);
}

/** The dash offset that draws `percent` of a circle of radius `r`. */
export function arcDashOffset(percent: number, radius: number): number {
	const circumference = 2 * Math.PI * radius;
	return circumference - (clamp(percent, 0, 100) / 100) * circumference;
}

/** Net amount after the fees a withdrawal actually charges. */
export function netAfterFees(gross: number, ...fees: (number | undefined)[]): number {
	const total = fees.reduce<number>((sum, f) => sum + (f ?? 0), 0);
	return Math.max(0, gross - total);
}
