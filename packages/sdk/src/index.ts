import {
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  type MagiConfig,
  type SwapAsset,
} from "@magi/core";
import {
  buildQuickSwap,
  type QuickSwapInput,
  type QuickSwapBuildResult,
} from "./quickSwap.js";
import {
  createDefaultPoolProvider,
  type PoolProvider,
} from "./poolProvider.js";
import type { PriceProvider } from "./priceProvider.js";
import {
  requestBtcDepositAddress,
  type BtcDepositRequest,
  type BtcDepositResult,
} from "./mappingBot.js";
import {
  createHiveBalanceProvider,
  type BalanceProvider,
} from "./balanceProvider.js";

export { MAINNET_CONFIG, TESTNET_CONFIG } from "@magi/core";
export type {
  MagiConfig,
  SwapAsset,
  ReferralConfig,
  SwapCalcResult,
} from "@magi/core";
export { CoinAmount } from "@magi/core";
export { createDefaultPoolProvider } from "./poolProvider.js";
export { createPoolPriceProvider } from "./priceProvider.js";
export { createHiveBalanceProvider } from "./balanceProvider.js";
export type { PoolProvider } from "./poolProvider.js";
export type { PriceProvider } from "./priceProvider.js";
export type { BalanceProvider } from "./balanceProvider.js";
export type { QuickSwapInput, QuickSwapBuildResult } from "./quickSwap.js";
export type { BtcDepositRequest, BtcDepositResult } from "./mappingBot.js";

export interface AiohaLike {
  signAndBroadcastTx(
    operations: unknown[],
    keyType: unknown,
  ): Promise<
    | { success: boolean; result?: string; error?: string }
    | { success: true; result: string }
  >;
}

export interface CreateMagiOptions {
  config?: MagiConfig;
  aioha?: AiohaLike;
  pools?: PoolProvider;
  prices?: PriceProvider;
  balances?: BalanceProvider;
}

export interface MagiClient {
  config: MagiConfig;
  pools: PoolProvider;
  prices?: PriceProvider;
  balances: BalanceProvider;
  buildQuickSwap: (input: QuickSwapInput) => Promise<QuickSwapBuildResult>;
  quickSwap: (
    input: QuickSwapInput,
    keyType?: unknown,
  ) => Promise<QuickSwapResult>;
  getBtcDepositAddress: (req: BtcDepositRequest) => Promise<BtcDepositResult>;
  getBalance: (username: string, asset: SwapAsset) => Promise<bigint | null>;
}

export interface QuickSwapResult {
  build: QuickSwapBuildResult;
  txId: string;
}

export function createMagi(opts: CreateMagiOptions = {}): MagiClient {
  const config = opts.config ?? MAINNET_CONFIG;
  const pools =
    opts.pools ?? createDefaultPoolProvider(undefined, config.indexerUrl);
  const prices = opts.prices;
  const balances = opts.balances ?? createHiveBalanceProvider();
  const aioha = opts.aioha;

  return {
    config,
    pools,
    prices,
    balances,
    async buildQuickSwap(input) {
      return buildQuickSwap(input, { config, pools, prices });
    },
    async quickSwap(input, keyType) {
      if (!aioha) {
        throw new Error(
          "createMagi was called without `aioha`; pass an Aioha instance to sign, or use buildQuickSwap() and broadcast yourself.",
        );
      }
      const build = await buildQuickSwap(input, { config, pools, prices });
      const res = await aioha.signAndBroadcastTx(build.ops, keyType);
      if (!res.success) {
        const err = "error" in res ? res.error : "unknown";
        throw new Error(`signAndBroadcastTx failed: ${err ?? "unknown"}`);
      }
      if (!("result" in res) || typeof res.result !== "string") {
        throw new Error("signAndBroadcastTx returned success but no tx id");
      }
      return { build, txId: res.result };
    },
    async getBtcDepositAddress(req) {
      return requestBtcDepositAddress(req, config);
    },
    async getBalance(username, asset) {
      return balances.getBalance(username, asset);
    },
  };
}
