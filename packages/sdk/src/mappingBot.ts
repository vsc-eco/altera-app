import type { MagiConfig, SwapAsset } from "@magi/core";

export interface BtcDepositRequest {
  recipient: string;
  assetOut: SwapAsset;
  destinationChain: "HIVE" | "BTC";
}

export interface BtcDepositResult {
  address: string;
  raw: string;
}

export async function requestBtcDepositAddress(
  req: BtcDepositRequest,
  config: MagiConfig,
): Promise<BtcDepositResult> {
  const url = config.mappingBotUrl;
  if (!url) throw new Error("mappingBotUrl not configured");

  const normalized = req.recipient.trim().startsWith("hive:")
    ? req.recipient.trim()
    : req.recipient.trim().startsWith("@")
      ? `hive:${req.recipient.trim().slice(1)}`
      : `hive:${req.recipient.trim()}`;

  const instruction = new URLSearchParams({
    swap_to: normalized,
    swap_asset_out: req.assetOut.toLowerCase(),
    destination_chain: req.destinationChain,
  }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Mapping bot error (${res.status}): ${text}`);

  const match = text.match(/address mapping (?:created|exists): (\S+)/);
  if (!match) throw new Error(`Unexpected mapping bot response: ${text}`);

  return { address: match[1], raw: text };
}
