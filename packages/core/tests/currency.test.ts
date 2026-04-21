import { describe, expect, it } from "vitest";
import { CoinAmount } from "../src/currency/CoinAmount.js";

describe("CoinAmount", () => {
  it("constructs from raw smallest-unit values", () => {
    const a = new CoinAmount(100_000n, "HBD");
    expect(a.raw).toBe(100_000n);
    expect(a.toDecimalString()).toBe("100.000");
    expect(a.toString()).toBe("100.000 HBD");
  });

  it("constructs BTC at 8 decimals", () => {
    const a = new CoinAmount(100_000n, "BTC");
    expect(a.toDecimalString()).toBe("0.00100000");
  });

  it("parses from decimal strings", () => {
    expect(CoinAmount.fromDecimal("1.234", "HIVE").raw).toBe(1234n);
    expect(CoinAmount.fromDecimal("0.00092247", "BTC").raw).toBe(92247n);
    expect(CoinAmount.fromDecimal("100", "HBD").raw).toBe(100000n);
  });

  it("rejects negatives", () => {
    expect(() => new CoinAmount(-1n, "HIVE")).toThrow("negative");
  });

  it("rejects too many decimals", () => {
    expect(() => CoinAmount.fromDecimal("1.2345", "HIVE")).toThrow(
      "too many decimals",
    );
  });

  it("pads fractional part when input is integer-like", () => {
    expect(CoinAmount.fromDecimal("1", "HIVE").toDecimalString()).toBe("1.000");
  });
});
