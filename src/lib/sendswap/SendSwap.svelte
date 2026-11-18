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
	import {
		mainnetSwapDest,
		mainnetSwapSource,
		resolveSourceNetwork
	} from '$lib/sendswap/utils/sendOptions';
	import { canUseMainnetSelf } from '$lib/sendswap/utils/recipientValidation';
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
	import { page } from '$app/state';
	import { coinParamFor } from '$lib/redesign/assetActions';
	import TransferSidebar from './stages/TransferSidebar.svelte';

	const { txType }: { txType: 'transfer' | 'swap' } = $props();

	const auth = $derived(getAuth()());

	// txType is a fixed string set by the parent route and never changes for the
	// lifetime of this component; use untrack to suppress the "captures initial
	// value" warning while still choosing the right state class at mount time.
	const txState = untrack(() => (txType === 'swap' ? new SwapTxState() : new TransferTxState()));
	provideTxState(txState);

	/**
	 * The source pair `applyStartDetails` opened with, while it is still
	 * eligible to be upgraded to the login's mainnet (M9). Cleared the first
	 * time the upgrade runs, and ignored if the user has since picked a source
	 * themselves — their choice outranks a default.
	 */
	let pendingSourceUpgrade = $state<{ coin?: string; network: string } | undefined>();

	$effect(() => {
		const want = pendingSourceUpgrade;
		if (!want || auth.status !== 'authenticated') return;
		// One shot either way: this must never fight the source dialog.
		pendingSourceUpgrade = undefined;
		const current = untrack(() => txState.from);
		if (!current || current.coin.value !== want.coin || current.network.value !== want.network) {
			return;
		}
		const target = mainnetSwapSource(current.coin.value);
		if (target.value === current.network.value) return;
		if (!canUseMainnetSelf(target.value, auth.value?.did, auth.value?.provider)) return;
		txState.from = { coin: current.coin, network: target };
	});

	function applyStartDetails() {
		if (txType === 'swap') {
			const stored = loadSwapSelection(SWAP_PAGE_PREF_KEY);
			const fromOpt = findFromOpt(stored?.fromCoin) ?? getFromOption(Coin.btc.value);
			const toOpt = findToOpt(stored?.toCoin) ?? getToOption(Coin.hive.value);
			/**
			 * A stored pair is not re-checked anywhere else, so the impossible
			 * source H1 could create came back on every reload (M7). Resolve it
			 * against what the coin can actually be on.
			 *
			 * With nothing stored the card opens mainnet-to-mainnet (M9): the
			 * normal swap pays from the wallet's own Hive L1 balance. That
			 * depends on the login — a reown wallet has no Hive account to sign
			 * the deposit op the L1 source needs — and the login resolves AFTER
			 * mount, so it cannot be decided here. Magi is the safe opening
			 * value and `upgradeSourceToMainnet` revisits it once the login is
			 * known. `mainnetSwapSource` answers Magi for BTC regardless, which
			 * cannot be swapped from Bitcoin L1 at all.
			 *
			 * The destination is NOT defaulted here: `SwapOptions` owns it, and
			 * resolves the same mainnet preference against the asset and the
			 * login every time either changes, so it needs no such catch-up.
			 */
			const fromNet = resolveSourceNetwork(
				fromOpt?.coin.value,
				(findNetwork(stored?.fromNetwork) ?? Network.magi).value
			);
			// Only a pair we chose ourselves may be upgraded later.
			pendingSourceUpgrade = findNetwork(stored?.fromNetwork)
				? undefined
				: { coin: fromOpt?.coin.value, network: fromNet.value };
			const toNet = findNetwork(stored?.toNetwork) ?? mainnetSwapDest(toOpt?.coin.value);
			// /swap page bridges external assets via Lightning even when
			// neither from nor to is on the Lightning network — override the
			// from/to-based derivation. See QuickSwap for the parallel case.
			txState.railOverride = Network.lightning;
			txState.from = fromOpt ? { coin: fromOpt.coin, network: fromNet } : undefined;
			txState.to = toOpt ? { coin: toOpt.coin, network: toNet } : undefined;
		} else {
			// The wallet's Assets rows link here as `/transfer?coin=…`, so the
			// asset the reader clicked is the one that opens. Anything else
			// (no param, an asset transfer cannot send, a hand-edited URL)
			// falls back to the first asset they actually hold.
			const requested = coinParamFor('transfer', page.url.searchParams.get('coin'));
			const balOpt = scanForBalance(
				[Coin.hive, Coin.hbd, Coin.shbd].map((c) => ({ coin: c, network: Network.magi }))
			);
			const coinOpt = getFromOption(requested) ?? getFromOption(balOpt?.coin.value);
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
	{#if txType === 'transfer'}
		<!-- Same two-column shape as DepositPage / WithdrawPage: the flow on the
		     left at a readable width, recent activity and FAQ on the right.
		     Without the rail the form stretched the full 1120px column and the
		     fields read as a wall. -->
		<div class="transfer-layout">
			<div class="transfer-flow-col">
				<StepsMachine size="page" {txType} resetState={applyStartDetails} {stepsData} />
			</div>
			<aside class="transfer-rail-col">
				<TransferSidebar />
			</aside>
		</div>
	{:else}
		<StepsMachine size="page" {txType} resetState={applyStartDetails} {stepsData} />
	{/if}
</div>

<style lang="scss">
	.send-internal-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.transfer-layout {
		display: grid;
		/* The padding below sits INSIDE the 100% width — this project has no
		   global border-box, and without this the layout runs past its column
		   by exactly the padding on a phone. */
		box-sizing: border-box;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 4rem;
		max-width: 66rem;
		width: 100%;
		margin: 0 auto;
		padding: 0 0 3rem;
	}
	.transfer-flow-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.transfer-rail-col {
		min-width: 0;
	}
	/* Matches the deposit and withdraw pages: the rail drops under the flow
	   before the two columns get too narrow to read. */
	@media (max-width: 1440px) {
		.transfer-layout {
			grid-template-columns: 1fr;
			gap: 2.5rem;
		}
	}
	@media (max-width: 720px) {
		.transfer-layout {
			gap: 2rem;
		}
	}
</style>
