import { describe, expect, it } from "vitest";
import { CoinAmount } from "../src/currency/CoinAmount.js";
import { getHiveSwapOp } from "../src/ops/swap.js";
import { MAINNET_CONFIG } from "../src/types/index.js";

/**
 * Byte-for-byte validation: rebuild the swap op for vaultec's real on-chain
 * tx `9a6ad6c7f15cf0ccca5523f57d5ad2b055a7c33c` and confirm the inner
 * `payload` JSON matches the actual Altera broadcast.
 *
 * Captured from VSC GraphQL `findTransaction` on 2026-04-17:
 *   asset_in: HBD,  asset_out: BTC
 *   amount_in: 100000 (= 100.000 HBD)
 *   min_amount_out: 0
 *   recipient: hive:vaultec
 *   (no destination_chain — stays on Magi L2, vaultec kept the BTC)
 *   intent: {type: 'transfer.allow', args: {limit: '100.000', token: 'hbd'}}
 */
describe("live-snapshot: vaultec 100 HBD → BTC (tx 9a6ad6c7)", () => {
  it("emits the exact payload Altera broadcast", () => {
    const op = getHiveSwapOp({
      username: "vaultec",
      amountIn: CoinAmount.fromDecimal("100", "HBD"),
      assetIn: "HBD",
      assetOut: "BTC",
      // Altera's Svelte path passes undefined for min here when caller skips;
      // that becomes '0' in the payload.
      config: MAINNET_CONFIG,
    });

    expect(op[0]).toBe("custom_json");
    expect(op[1].id).toBe("vsc.call");

    const outer = JSON.parse(op[1].json);
    expect(outer.net_id).toBe("vsc-mainnet");
    expect(outer.caller).toBe("hive:vaultec");
    expect(outer.contract_id).toBe("vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45");
    expect(outer.action).toBe("execute");
    expect(outer.rc_limit).toBe(2_000);
    expect(outer.intents).toEqual([
      { type: "transfer.allow", args: { limit: "100.000", token: "hbd" } },
    ]);

    const payload = JSON.parse(outer.payload);
    expect(payload).toEqual({
      type: "swap",
      version: "1.0.0",
      asset_in: "HBD",
      asset_out: "BTC",
      amount_in: "100000",
      min_amount_out: "0",
      recipient: "hive:vaultec",
    });
  });
});

/**
 * Live snapshot: lordbutterfly's 30 HIVE → BTC multihop withdrawal
 * (tx a4224a2b1ffaa43150724dd60f37384447576bad, 2026-04-17).
 *
 *   asset_in: HIVE,  asset_out: BTC
 *   amount_in: 30000 (= 30 HIVE)
 *   min_amount_out: 2355 sats
 *   recipient: bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss
 *   destination_chain: BTC
 *   intent: {type: 'transfer.allow', args: {limit: '30.000', token: 'hive'}}
 */
describe("live-snapshot: lordbutterfly 30 HIVE → BTC withdrawal (tx a4224a2b)", () => {
  it("emits the exact payload including destination_chain", () => {
    const op = getHiveSwapOp({
      username: "lordbutterfly",
      amountIn: CoinAmount.fromDecimal("30", "HIVE"),
      assetIn: "HIVE",
      assetOut: "BTC",
      minAmountOut: 2355n,
      destinationChain: "BTC",
      destinationRecipient: "bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss",
      config: MAINNET_CONFIG,
    });

    const outer = JSON.parse(op[1].json);
    expect(outer.intents).toEqual([
      { type: "transfer.allow", args: { limit: "30.000", token: "hive" } },
    ]);

    const payload = JSON.parse(outer.payload);
    expect(payload).toEqual({
      type: "swap",
      version: "1.0.0",
      asset_in: "HIVE",
      asset_out: "BTC",
      amount_in: "30000",
      min_amount_out: "2355",
      recipient: "bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss",
      destination_chain: "BTC",
    });
  });
});
