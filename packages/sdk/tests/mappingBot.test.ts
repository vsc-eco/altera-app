import { describe, expect, it } from "vitest";
import { requestBtcDepositAddress } from "../src/mappingBot.js";
import { MAINNET_CONFIG } from "@magi/core";

describe("requestBtcDepositAddress (live)", () => {
  it("returns a BTC address for a HIVE swap instruction", async () => {
    const res = await requestBtcDepositAddress(
      {
        recipient: "lordbutterfly",
        assetOut: "HIVE",
        destinationChain: "HIVE",
      },
      MAINNET_CONFIG,
    );
    expect(res.address).toMatch(/^bc1q/);
    expect(res.raw).toContain("address mapping");
    expect(res.raw).toContain("swap_to=hive%3Alordbutterfly");
  });

  it("returns a different address for HBD vs HIVE output", async () => {
    const hive = await requestBtcDepositAddress(
      {
        recipient: "lordbutterfly",
        assetOut: "HIVE",
        destinationChain: "HIVE",
      },
      MAINNET_CONFIG,
    );
    const hbd = await requestBtcDepositAddress(
      { recipient: "lordbutterfly", assetOut: "HBD", destinationChain: "HIVE" },
      MAINNET_CONFIG,
    );
    expect(hive.address).not.toBe(hbd.address);
  });

  it("returns the same address on repeated calls (deterministic)", async () => {
    const a = await requestBtcDepositAddress(
      { recipient: "tibfox", assetOut: "HIVE", destinationChain: "HIVE" },
      MAINNET_CONFIG,
    );
    const b = await requestBtcDepositAddress(
      { recipient: "tibfox", assetOut: "HIVE", destinationChain: "HIVE" },
      MAINNET_CONFIG,
    );
    expect(a.address).toBe(b.address);
  });

  it("normalizes bare username to hive: prefix", async () => {
    const bare = await requestBtcDepositAddress(
      {
        recipient: "lordbutterfly",
        assetOut: "HIVE",
        destinationChain: "HIVE",
      },
      MAINNET_CONFIG,
    );
    const prefixed = await requestBtcDepositAddress(
      {
        recipient: "hive:lordbutterfly",
        assetOut: "HIVE",
        destinationChain: "HIVE",
      },
      MAINNET_CONFIG,
    );
    expect(bare.address).toBe(prefixed.address);
  });
});
