import { ASSET_DECIMALS, type SwapAsset } from "../types/index.js";

/**
 * Integer-safe amount for a Magi-supported asset.
 *
 * `raw` is the smallest-unit value (e.g. sats for BTC, milli-HIVE for HIVE).
 * `asset` is one of HIVE, HBD, BTC. Decimals are fixed per asset.
 *
 * Mirrors the semantics of altera-app's `CoinAmount` for the three assets we
 * care about — we intentionally drop the stablecoin/sats display variants,
 * conversion helpers, and formatting polish because the SDK doesn't do UI.
 */
export class CoinAmount {
  readonly asset: SwapAsset;
  readonly raw: bigint;

  constructor(raw: bigint | number | string, asset: SwapAsset) {
    if (typeof raw === "string") {
      raw = BigInt(raw);
    } else if (typeof raw === "number") {
      if (!Number.isFinite(raw)) {
        throw new Error(`CoinAmount: non-finite number input (${raw})`);
      }
      raw = BigInt(Math.trunc(raw));
    }
    if (raw < 0n) throw new Error("CoinAmount: negative amount");
    this.raw = raw;
    this.asset = asset;
  }

  /** Construct from a decimal string ("1.234") or number. */
  static fromDecimal(decimal: string | number, asset: SwapAsset): CoinAmount {
    const d = ASSET_DECIMALS[asset];
    const s = typeof decimal === "number" ? decimal.toString() : decimal.trim();
    if (!/^\d+(?:\.\d+)?$/.test(s)) {
      throw new Error(`CoinAmount.fromDecimal: invalid input "${s}"`);
    }
    const [whole, frac = ""] = s.split(".");
    if (frac.length > d) {
      throw new Error(
        `CoinAmount.fromDecimal: too many decimals for ${asset} (max ${d})`,
      );
    }
    const padded = (frac + "0".repeat(d)).slice(0, d);
    const raw = BigInt(whole) * BigInt(10 ** d) + BigInt(padded || "0");
    return new CoinAmount(raw, asset);
  }

  get decimals(): number {
    return ASSET_DECIMALS[this.asset];
  }

  /** Return the decimal string representation ("1.234"). Always pads to full decimals. */
  toDecimalString(): string {
    const d = this.decimals;
    const base = BigInt(10) ** BigInt(d);
    const whole = this.raw / base;
    const frac = this.raw % base;
    return `${whole}.${frac.toString().padStart(d, "0")}`;
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.asset}`;
  }
}
