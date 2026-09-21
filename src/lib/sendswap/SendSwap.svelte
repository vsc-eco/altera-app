<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { getFromOption, getToOption, Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { scanForBalance } from '$lib/sendswap/utils/sendUtils';
	import {
		SWAP_PAGE_PREF_KEY,
		loadSwapSelection,
		saveSwapSelection,
		findFromOpt,
		findToOpt,
		findNetwork
	} from '$lib/sendswap/utils/swapPersistence';
	import SwapOptions from './stages/SwapOptions.svelte';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Complete from '$lib/sendswap/stages/Complete.svelte';
	import TransferOptions from './stages/TransferOptions.svelte';
	import ReviewTransfer from './stages/ReviewTransfer.svelte';
	import ReviewSwap from './stages/ReviewSwap.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import { SwapTxState, TransferTxState, provideTxState } from './utils/txState.svelte';
	import { onMount, untrack } from 'svelte';
	import { fetchCustomTokens, customTokenCoin } from '$lib/tokens/customTokens';

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());

	// txType is a fixed string set by the parent route and never changes for the
	// lifetime of this component; use untrack to suppress the "captures initial
	// value" warning while still choosing the right state class at mount time.
	const txState = untrack(() => txType === 'swap' ? new SwapTxState() : new TransferTxState());
	provideTxState(txState);

	function applyStartDetails() {
		if (txType === 'swap') {
			const stored = loadSwapSelection(SWAP_PAGE_PREF_KEY);
			const fromOpt =
				findFromOpt(stored?.fromCoin) ??
				getFromOption(Coin.btc.value);
			const toOpt =
				findToOpt(stored?.toCoin) ??
				getToOption(Coin.hive.value);
			const fromNet = findNetwork(stored?.fromNetwork) ?? Network.magi;
			const toNet = findNetwork(stored?.toNetwork) ?? Network.magi;
			// /swap page bridges external assets via Lightning even when
			// neither from nor to is on the Lightning network — override the
			// from/to-based derivation. See QuickSwap for the parallel case.
			txState.railOverride = Network.lightning;
			txState.from = fromOpt ? { coin: fromOpt.coin, network: fromNet } : undefined;
			txState.to = toOpt ? { coin: toOpt.coin, network: toNet } : undefined;
		} else {
			const balOpt = scanForBalance(
				[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({ coin: c, network: Network.magi }))
			);
			const coinOpt = getFromOption(balOpt?.coin.value);
			txState.from = coinOpt ? { coin: coinOpt.coin, network: Network.magi } : undefined;
			txState.to = coinOpt ? { coin: coinOpt.coin, network: Network.magi } : undefined;
		}
	}

	applyStartDetails();

	/**
	 * Restore a persisted CUSTOM-token selection.
	 *
	 * Only coin values are persisted, and resolving one to a Coin needs token
	 * discovery, which is async — while `applyStartDetails` has to run
	 * synchronously at mount. So a stored custom token resolved to undefined
	 * above and silently fell back to the BTC→HIVE default: pick LASSECASH,
	 * reload, and the page forgot it.
	 *
	 * Natives are restored synchronously as before; this upgrades the
	 * selection afterwards, and only if:
	 *   - the stored coin is a currently swappable custom token (a token that
	 *     has since been de-listed must NOT come back), and
	 *   - that side still holds exactly what mount put there, so a user who
	 *     picked something during the round-trip isn't overridden.
	 */
	onMount(async () => {
		if (txType !== 'swap') return;
		const stored = loadSwapSelection(SWAP_PAGE_PREF_KEY);
		if (!stored?.fromCoin && !stored?.toCoin) return;

		const needsFrom = !!stored.fromCoin && !findFromOpt(stored.fromCoin);
		const needsTo = !!stored.toCoin && !findToOpt(stored.toCoin);
		if (!needsFrom && !needsTo) return;

		const mountedFrom = txState.from?.coin.value;
		const mountedTo = txState.to?.coin.value;

		const tokens = await fetchCustomTokens();
		const find = (v: string | undefined) => tokens.find((t) => t.symbol === v);

		if (needsFrom && txState.from?.coin.value === mountedFrom) {
			const token = find(stored.fromCoin);
			// Custom tokens live on Magi only, so the stored network is moot.
			if (token) txState.from = { coin: customTokenCoin(token), network: Network.magi };
		}
		if (needsTo && txState.to?.coin.value === mountedTo) {
			const token = find(stored.toCoin);
			if (token) txState.to = { coin: customTokenCoin(token), network: Network.magi };
		}
	});

	$effect(() => {
		// sets username for swap
		if (txType !== 'swap') return;
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) txState.toUsername = username;
		}
	});

	// Persist the user's source/target selection while on the swap page.
	// Uses its own localStorage key so the dashboard QuickSwap selection
	// stays independent.
	$effect(() => {
		if (txType !== 'swap') return;
		const fromCoin = txState.from?.coin.value;
		const fromNetwork = txState.from?.network.value;
		const toCoin = txState.to?.coin.value;
		const toNetwork = txState.to?.network.value;
		// Only save once both sides are populated; partial state isn't useful.
		if (fromCoin && toCoin) {
			saveSwapSelection(SWAP_PAGE_PREF_KEY, { fromCoin, fromNetwork, toCoin, toNetwork });
		}
	});

	const stepsData: MixedStepsArray = $derived(
		txType === 'swap'
			? [
					{ value: 'options', component: SwapOptions },
					{ value: 'review', component: ReviewSwap, popup: true },
					{ value: 'complete', component: Complete, popup: true }
				]
			: [
					{ value: 'options', component: TransferOptions },
					{ value: 'review', component: ReviewTransfer },
					{ value: 'complete', component: Complete }
				]
	);
</script>

<div class="send-internal-wrapper">
	<StepsMachine size="page" {txType} resetState={applyStartDetails} {stepsData} />
</div>

<style lang="scss">
	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
</style>
