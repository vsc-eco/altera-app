import type { SwapAsset } from "@magi/core";

export interface BalanceProvider {
  getBalance(username: string, asset: SwapAsset): Promise<bigint | null>;
}

export function createHiveBalanceProvider(
  hiveApiUrl = "https://api.hive.blog",
): BalanceProvider {
  let cache: {
    username: string;
    balances: Record<string, bigint>;
    at: number;
  } | null = null;
  const TTL_MS = 5_000;

  async function refresh(username: string): Promise<Record<string, bigint>> {
    const now = Date.now();
    if (cache && cache.username === username && now - cache.at < TTL_MS)
      return cache.balances;

    const res = await fetch(hiveApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_accounts",
        params: [[username]],
        id: 1,
      }),
    });
    if (!res.ok) return cache?.balances ?? {};
    const body = await res.json();
    const acct = body?.result?.[0];
    if (!acct) return {};

    const balances: Record<string, bigint> = {};

    const hiveBal = acct.balance;
    if (typeof hiveBal === "string") {
      const match = hiveBal.match(/^([\d.]+)/);
      if (match)
        balances.HIVE = BigInt(Math.round(parseFloat(match[1]) * 1000));
    }

    const hbdBal = acct.hbd_balance;
    if (typeof hbdBal === "string") {
      const match = hbdBal.match(/^([\d.]+)/);
      if (match) balances.HBD = BigInt(Math.round(parseFloat(match[1]) * 1000));
    }

    cache = { username, balances, at: now };
    return balances;
  }

  return {
    async getBalance(username, asset) {
      if (!username) return null;
      const balances = await refresh(username);
      return balances[asset] ?? null;
    },
  };
}
