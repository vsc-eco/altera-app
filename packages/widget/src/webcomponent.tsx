import r2wc from "@r2wc/react-to-web-component";
import { MagiQuickSwap, type MagiQuickSwapProps } from "./QuickSwap.js";
import "./styles.css";

/**
 * Register <magi-quickswap /> as a web component so non-React hosts (vanilla
 * JS, Vue, Svelte, Next SSR, etc.) can embed the widget with a single tag.
 *
 * Props are assigned at the DOM level via `element.aioha = ...`,
 * `element.username = '...'`, etc. Attributes are not used for object-valued
 * props (Aioha instance, config, providers); use the property syntax.
 */
const WebComponent = r2wc(
  MagiQuickSwap as unknown as (p: MagiQuickSwapProps) => JSX.Element,
  {
    props: {
      username: "string",
      defaultAssetIn: "string",
      defaultAssetOut: "string",
      defaultSlippageBps: "number",
      className: "string",
      aioha: "json",
      config: "json",
      pools: "json",
      prices: "json",
      keyType: "json",
      onSuccess: "function",
      onError: "function",
    },
  },
);

if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  if (!customElements.get("magi-quickswap")) {
    customElements.define("magi-quickswap", WebComponent);
  }
}

export { WebComponent as MagiQuickSwapElement };
