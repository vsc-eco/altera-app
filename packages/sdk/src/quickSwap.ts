import {
  CoinAmount,
  calculateSwap,
  calculateTwoHopSwap,
  getHiveDepositOp,
  getHiveSwapOp,
  referralQualifies,
  type DestinationChain,
  type MagiConfig,
  type PoolDepths,
  type SwapAsset,
  type SwapCalcResult,
} from "@magi/core";
import type { PoolProvider } from "./poolProvider.js";
import type { PriceProvider } from "./priceProvider.js";

export interface QuickSwapInput {
  username: string;
  assetIn: "HIVE" | "HBD";
  amountIn: CoinAmount;
  assetOut: SwapAsset;
  recipient: string;
  slippageBps?: number;
}

export interface QuickSwapBuildResult {
  /** `[depositOp, swapOp]` — pass to Aioha's signAndBroadcastTx. */
  ops: unknown[];
  preview: SwapCalcResult & { hops: 1 | 2 };
  /** True when the referral branch was taken and fee fields were added. */
  referralApplied: boolean;
}

/**
 * Compose the two-op QuickSwap broadcast:
 *   1) L1 → Magi deposit (HIVE or HBD)
 *   2) DEX router call with destination_chain settlement to the user's L1 target
 *
 * This is what altera-app/src/lib/cards/QuickSwap.svelte:844-872 does, boiled
 * down to a single function with pluggable pool/price sources.
 */
export async function buildQuickSwap(
  input: QuickSwapInput,
  deps: {
    config: MagiConfig;
    pools: PoolProvider;
    prices?: PriceProvider;
  },
): Promise<QuickSwapBuildResult> {
  const {
    username,
    assetIn,
    amountIn,
    assetOut,
    recipient,
    slippageBps = 100,
  } = input;
  const { config, pools, prices } = deps;

  if (assetIn !== "HIVE" && assetIn !== "HBD") {
    throw new Error("QuickSwap currently only supports HIVE or HBD as input");
  }
  if (amountIn.asset !== assetIn) {
    throw new Error(
      `amountIn asset (${amountIn.asset}) does not match assetIn (${assetIn})`,
    );
  }
  if (assetIn === assetOut) {
    throw new Error("assetIn and assetOut must differ");
  }

  const destinationChain: DestinationChain =
    assetOut === "BTC" ? "BTC" : "HIVE";

  // Preview: pick single-hop vs two-hop math based on whether there's a
  // direct pool for the pair.
  const preview = await previewSwap(
    amountIn,
    assetIn,
    assetOut,
    slippageBps,
    pools,
  );

  // Referral-fee qualification. Skip the network call entirely if no referral
  // configured — saves a round-trip for zero-effect lookups.
  let referralApplied = false;
  if (config.referral) {
    if (!prices) {
      throw new Error(
        "Referral fee is configured but no PriceProvider was supplied. Pass `prices` to enable referral quoting.",
      );
    }
    const usd = await prices.getUsdPerUnit(assetIn);
    const inputUsd =
      usd !== null && Number.isFinite(usd)
        ? Number(amountIn.toDecimalString()) * usd
        : 0;
    referralApplied = referralQualifies({
      assetOut,
      destinationChain,
      inputUsd,
      referral: config.referral,
    });
  }

  const ops: unknown[] = [];
  ops.push(
    getHiveDepositOp({
      from: username,
      toDid: `hive:${username}`,
      amount: amountIn,
      config,
    }),
  );
  ops.push(
    getHiveSwapOp({
      username,
      amountIn,
      assetIn,
      assetOut,
      minAmountOut:
        preview.minAmountOut > 0n ? preview.minAmountOut : undefined,
      destinationChain,
      destinationRecipient: normalizeRecipient(assetOut, recipient),
      config,
      referralQualifies: referralApplied,
    }),
  );

  return { ops, preview, referralApplied };
}

function normalizeRecipient(assetOut: SwapAsset, recipient: string): string {
  const trimmed = recipient.trim();
  if (assetOut === "BTC") return trimmed;
  // HIVE/HBD → ensure hive: prefix
  if (trimmed.startsWith("hive:")) return trimmed;
  if (trimmed.startsWith("@")) return `hive:${trimmed.slice(1)}`;
  return `hive:${trimmed}`;
}

async function previewSwap(
  amountIn: CoinAmount,
  assetIn: SwapAsset,
  assetOut: SwapAsset,
  slippageBps: number,
  pools: PoolProvider,
): Promise<SwapCalcResult & { hops: 1 | 2 }> {
  // Try direct pool first.
  const direct = await pools.getPoolDepths(assetIn, assetOut);
  if (direct) {
    const d = orderedDepths(direct, assetIn);
    if (d) {
      const r = calculateSwap(amountIn.raw, d.X, d.Y, slippageBps);
      return { ...r, hops: 1 };
    }
  }

  // No direct pool → two-hop via HBD (mirrors router autodiscovery).
  const hop1Asset = assetIn;
  const hopMid = "HBD" as SwapAsset;
  const hop2Asset = assetOut;
  if (hop1Asset === hopMid || hop2Asset === hopMid) {
    // Direct-pool case should have been found above; fall through.
    return {
      baseFee: 0n,
      clpFee: 0n,
      totalFee: 0n,
      expectedOutput: 0n,
      minAmountOut: 0n,
      slippageBps,
      hops: 1,
    };
  }
  const [pool1, pool2] = await Promise.all([
    pools.getPoolDepths(hop1Asset, hopMid),
    pools.getPoolDepths(hopMid, hop2Asset),
  ]);
  if (!pool1 || !pool2) {
    return {
      baseFee: 0n,
      clpFee: 0n,
      totalFee: 0n,
      expectedOutput: 0n,
      minAmountOut: 0n,
      slippageBps,
      hops: 2,
    };
  }
  const r = calculateTwoHopSwap(
    amountIn.raw,
    pool1,
    pool2,
    assetIn.toLowerCase(),
    hopMid.toLowerCase(),
    assetOut.toLowerCase(),
    slippageBps,
  );
  return { ...r, hops: 2 };
}

function orderedDepths(
  depths: PoolDepths,
  assetIn: string,
): { X: bigint; Y: bigint } | null {
  const a = assetIn.toLowerCase();
  if (depths.asset0 === a) return { X: depths.reserve0, Y: depths.reserve1 };
  if (depths.asset1 === a) return { X: depths.reserve1, Y: depths.reserve0 };
  return null;
}
