/**
 * Per-source txState initialization for the deposit flow.
 *
 * EXTRACTED VERBATIM from the `$effect` blocks in DepositOptions.svelte
 * (the lightningOpen / hiveMainnetOpen effects) so that the new
 * DepositFlow picker and the legacy DepositOptions menu initialize
 * `DepositTxState` through the SAME code path. Payload equivalence
 * between old and new flows follows by construction: identical txState
 * in → identical broadcast payload out (the txState → decideBroadcast →
 * sendUtils pipeline is pinned by the existing flow tests).
 *
 * Coinbase and Bitcoin Mainnet perform no txState initialization in the
 * legacy flow (their components own their inputs), so they have no init
 * function here.
 *
 * The functions mutate the passed state object's `from`/`to` — same
 * semantics as the original effects mutating the context txState.
 */
import swapOptions, {
	getFromOption,
	getToOption,
	Coin,
	Network,
	type AssetOption,
	type CoinOnNetwork
} from '../../utils/sendOptions';

/** The four deposit sources the picker offers. */
export type DepositSource = 'lightning' | 'hive_mainnet' | 'coinbase' | 'btc_mainnet';

/** Minimal slice of DepositTxState the init functions touch. */
export type DepositInitState = {
	from: CoinOnNetwork | undefined;
	to: CoinOnNetwork | undefined;
};

/**
 * Lightning deposit init — mirror of DepositOptions' `lightningOpen`
 * effect body (sans the toggleHiveMainnet(false) UI concern).
 */
export function initLightningDeposit(txState: DepositInitState): void {
	const satsCoin: AssetOption = {
		coin: Coin.sats,
		networks: [Network.magi]
	};
	const btcCoin = getFromOption(Coin.btc.value);

	const fromAsset = txState.from ? getFromOption(txState.from.coin.value) : undefined;
	const shouldPreserveFromCoin = !!fromAsset?.networks?.some(
		(n) => n.value === Network.lightning.value
	);

	const hiveCoin = getToOption(Coin.hive.value);
	const hbdCoin = getToOption(Coin.hbd.value);
	let toCoinToUse: AssetOption | undefined = satsCoin; // default to Magi SATS
	if (
		txState.to &&
		(txState.to.coin.value === Coin.hive.value ||
			txState.to.coin.value === Coin.hbd.value ||
			txState.to.coin.value === Coin.sats.value)
	) {
		// SATS isn't in swapOptions.to, so fall back to the local satsCoin
		// rather than calling getToOption (which would return undefined).
		toCoinToUse =
			txState.to.coin.value === Coin.sats.value ? satsCoin : getToOption(txState.to.coin.value);
	} else if (
		txState.from &&
		(txState.from.coin.value === Coin.hive.value ||
			txState.from.coin.value === Coin.hbd.value ||
			txState.from.coin.value === Coin.sats.value)
	) {
		toCoinToUse =
			txState.from.coin.value === Coin.hive.value
				? hiveCoin
				: txState.from.coin.value === Coin.hbd.value
					? hbdCoin
					: satsCoin;
	}

	// rail derives to lightning from from.network = lightning
	const newFromCoin = shouldPreserveFromCoin ? fromAsset : btcCoin;
	txState.from = newFromCoin ? { coin: newFromCoin.coin, network: Network.lightning } : undefined;
	txState.to = toCoinToUse ? { coin: toCoinToUse.coin, network: Network.magi } : undefined;
}

/**
 * Hive Mainnet deposit init — mirror of DepositOptions' `hiveMainnetOpen`
 * effect body (sans the toggleLightning(false) UI concern).
 */
export function initHiveMainnetDeposit(txState: DepositInitState): void {
	const hiveCoin =
		swapOptions.from.find(
			(coinOpt) =>
				coinOpt.coin.value === Coin.hive.value &&
				coinOpt.networks.some((n) => n.value === Network.hiveMainnet.value)
		) ||
		swapOptions.from.find(
			(coinOpt) =>
				coinOpt.coin.value === Coin.hbd.value &&
				coinOpt.networks.some((n) => n.value === Network.hiveMainnet.value)
		);
	const hbdCoin = swapOptions.from.find(
		(coinOpt) =>
			coinOpt.coin.value === Coin.hbd.value &&
			coinOpt.networks.some((n) => n.value === Network.hiveMainnet.value)
	);

	// For Hive Mainnet deposit, default to HIVE (or HBD) without
	// requiring a Magi balance — user deposits precisely because
	// their Magi balance may be 0.
	const fromAsset = txState.from ? getFromOption(txState.from.coin.value) : undefined;
	let fromCoinToUse = hiveCoin;
	if (fromAsset?.networks?.some((n) => n.value === Network.hiveMainnet.value)) {
		fromCoinToUse = fromAsset;
	} else if (
		txState.to &&
		(txState.to.coin.value === Coin.hive.value || txState.to.coin.value === Coin.hbd.value)
	) {
		fromCoinToUse = txState.to.coin.value === Coin.hive.value ? hiveCoin : hbdCoin;
	}

	// rail derives to magi from { hiveMainnet → magi }
	txState.from = fromCoinToUse
		? { coin: fromCoinToUse.coin, network: Network.hiveMainnet }
		: undefined;
	txState.to = fromCoinToUse ? { coin: fromCoinToUse.coin, network: Network.magi } : undefined;
}

/**
 * Dispatch helper for the picker: initialize txState for the chosen
 * source. Coinbase / BTC mainnet intentionally do nothing (parity with
 * the legacy flow, where their components own all inputs).
 */
export function initDepositStateForSource(txState: DepositInitState, source: DepositSource): void {
	if (source === 'lightning') initLightningDeposit(txState);
	else if (source === 'hive_mainnet') initHiveMainnetDeposit(txState);
}
