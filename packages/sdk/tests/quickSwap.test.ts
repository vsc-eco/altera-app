import { describe, expect, it } from "vitest";
import {
  CoinAmount,
  MAINNET_CONFIG,
  createMagi,
  type PoolProvider,
} from "../src/index.js";

/**
 * Mock pool provider serving the same reserves I confirmed on-chain at block
 * 105609432 (post vaultec's 10 HBD → BTC swap).
 */
function mockPools(): PoolProvider {
  return {
    async getPoolDepths(a, b) {
      const pair = [a, b]
        .map((s) => s.toLowerCase())
        .sort()
        .join("/");
      if (pair === "btc/hbd") {
        return {
          contractId: MAINNET_CONFIG.dexRouterContractId,
          asset0: "btc",
          asset1: "hbd",
          reserve0: 559_681n,
          reserve1: 610_105n,
        };
      }
      if (pair === "hbd/hive") {
        return {
          contractId: MAINNET_CONFIG.dexRouterContractId,
          asset0: "hbd",
          asset1: "hive",
          reserve0: 502_180n,
          reserve1: 8_108_542n,
        };
      }
      return null;
    },
  };
}

describe("createMagi + buildQuickSwap", () => {
  it("builds the deposit + swap op pair for HBD → BTC withdrawal", async () => {
    const magi = createMagi({ pools: mockPools() });
    const res = await magi.buildQuickSwap({
      username: "vaultec",
      assetIn: "HBD",
      amountIn: CoinAmount.fromDecimal("10", "HBD"),
      assetOut: "BTC",
      recipient: "bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss",
      slippageBps: 100,
    });

    expect(res.ops).toHaveLength(2);

    const [depositOp, swapOp] = res.ops as [
      [string, Record<string, string>],
      [string, Record<string, string>],
    ];
    expect(depositOp[0]).toBe("transfer");
    expect(depositOp[1].to).toBe("vsc.gateway");
    expect(depositOp[1].amount).toBe("10.000 HBD");

    expect(swapOp[0]).toBe("custom_json");
    const outer = JSON.parse(swapOp[1].json);
    const inner = JSON.parse(outer.payload);
    expect(inner.asset_in).toBe("HBD");
    expect(inner.asset_out).toBe("BTC");
    expect(inner.destination_chain).toBe("BTC");
    expect(inner.recipient).toBe("bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss");
    expect(res.preview.hops).toBe(1);
    expect(res.preview.expectedOutput).toBeGreaterThan(0n);
  });

  it("routes HIVE → BTC as two-hop and settles on BTC chain", async () => {
    const magi = createMagi({ pools: mockPools() });
    const res = await magi.buildQuickSwap({
      username: "lordbutterfly",
      assetIn: "HIVE",
      amountIn: CoinAmount.fromDecimal("30", "HIVE"),
      assetOut: "BTC",
      recipient: "bc1qexampleexampleexampleexampleexamplexxyz",
    });
    expect(res.preview.hops).toBe(2);

    const [, swapOp] = res.ops as [unknown, [string, Record<string, string>]];
    const outer = JSON.parse(swapOp[1].json);
    const inner = JSON.parse(outer.payload);
    expect(inner.asset_in).toBe("HIVE");
    expect(inner.asset_out).toBe("BTC");
    expect(inner.destination_chain).toBe("BTC");
  });

  it("prefixes HIVE recipients with hive: and settles on HIVE chain", async () => {
    const magi = createMagi({ pools: mockPools() });
    const res = await magi.buildQuickSwap({
      username: "vaultec",
      assetIn: "HBD",
      amountIn: CoinAmount.fromDecimal("5", "HBD"),
      assetOut: "HIVE",
      recipient: "vaultec",
    });
    const [, swapOp] = res.ops as [unknown, [string, Record<string, string>]];
    const outer = JSON.parse(swapOp[1].json);
    const inner = JSON.parse(outer.payload);
    expect(inner.destination_chain).toBe("HIVE");
    expect(inner.recipient).toBe("hive:vaultec");
  });

  it("rejects same-asset swap", async () => {
    const magi = createMagi({ pools: mockPools() });
    await expect(
      magi.buildQuickSwap({
        username: "vaultec",
        assetIn: "HBD",
        amountIn: CoinAmount.fromDecimal("1", "HBD"),
        assetOut: "HBD",
        recipient: "vaultec",
      }),
    ).rejects.toThrow("differ");
  });

  it("rejects BTC as input (widget scope)", async () => {
    const magi = createMagi({ pools: mockPools() });
    await expect(
      magi.buildQuickSwap({
        // @ts-expect-error intentional — assetIn is typed to 'HIVE' | 'HBD'
        username: "vaultec",
        assetIn: "BTC",
        amountIn: CoinAmount.fromDecimal("0.001", "BTC"),
        assetOut: "HBD",
        recipient: "vaultec",
      }),
    ).rejects.toThrow();
  });
});

describe("createMagi.quickSwap() with mock Aioha", () => {
  it("passes the built ops to aioha.signAndBroadcastTx and returns the tx id", async () => {
    let capturedOps: unknown[] = [];
    const mockAioha = {
      async signAndBroadcastTx(ops: unknown[]) {
        capturedOps = ops;
        return {
          success: true,
          result: "f8a9e34d183a3497081472cde143fc6d1ed8b957",
        };
      },
    };
    const magi = createMagi({ aioha: mockAioha, pools: mockPools() });
    const res = await magi.quickSwap({
      username: "vaultec",
      assetIn: "HBD",
      amountIn: CoinAmount.fromDecimal("10", "HBD"),
      assetOut: "BTC",
      recipient: "bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss",
    });
    expect(res.txId).toBe("f8a9e34d183a3497081472cde143fc6d1ed8b957");
    expect(capturedOps).toHaveLength(2);
  });

  it("throws when no aioha is configured", async () => {
    const magi = createMagi({ pools: mockPools() });
    await expect(
      magi.quickSwap({
        username: "vaultec",
        assetIn: "HBD",
        amountIn: CoinAmount.fromDecimal("1", "HBD"),
        assetOut: "BTC",
        recipient: "bc1qxxx",
      }),
    ).rejects.toThrow("was called without `aioha`");
  });
});
