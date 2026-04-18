<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import { liquidityDraftStore } from '$lib/pools/liquidityStore';
	import { get } from 'svelte/store';
	import { untrack } from 'svelte';

	let { editStage, pools = [] }: { editStage: (complete: boolean) => void; pools: PoolRow[] } =
		$props();

	// When opened via a row/detail action the parent seeds
	// `liquidityDraftStore.selectedPool` before mounting this stage.
	// Pick it up once so the Select and amount inputs are pre-populated.
	const preseeded = untrack(() => get(liquidityDraftStore).selectedPool);

	let selectedPool = $state<PoolRow | null>(preseeded);
	let amount0Ca = $state(new CoinAmount(0, Coin.hbd));
	let amount1Ca = $state(new CoinAmount(0, Coin.btc));

	const poolOptions = $derived(pools.map((p) => ({ value: p.id, label: p.pair })));
	const initialPoolId = preseeded?.id;

	function applyPool(pool: PoolRow | null) {
		selectedPool = pool;
		if (pool) {
			const c0 = detectCoin(pool.pairSymbols[0]);
			const c1 = detectCoin(pool.pairSymbols[1]);
			const isBtcHbd =
				[c0.value, c1.value].includes(Coin.btc.value) &&
				[c0.value, c1.value].includes(Coin.hbd.value);
			// For BTC/HBD pools we always want the HBD side as the
			// editable (slot 0) and the BTC side as the auto-calculated
			// (slot 1), regardless of the pool's alphabetical pair order.
			// For any other pair (HIVE/HBD etc.) we follow the pool's
			// canonical ordering.
			if (isBtcHbd) {
				amount0Ca = new CoinAmount(0, Coin.hbd);
				amount1Ca = new CoinAmount(0, Coin.btc);
			} else {
				amount0Ca = new CoinAmount(0, c0);
				amount1Ca = new CoinAmount(0, c1);
			}
		}
	}

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		const pool = pools.find((p) => p.id === id) ?? null;
		applyPool(pool);
	}

	// Initialise coin amounts for the preseeded pool so the first
	// render already shows the right asset slots.
	if (preseeded) applyPool(preseeded);

	const hiveAssetName = $derived(getHiveAssetName());
	const hbdAssetName = $derived(getHbdAssetName());
	function displayUnitForCoin(c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc): string {
		if (c.value === Coin.btc.value) return 'BTC';
		return c.value === Coin.hive.value ? hiveAssetName : hbdAssetName;
	}

	function detectCoin(symbol: string): typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc {
		const upper = symbol.toUpperCase();
		if (upper.includes('BTC')) return Coin.btc;
		if (upper.includes('HBD')) return Coin.hbd;
		return Coin.hive;
	}

	const coin0 = $derived(selectedPool ? detectCoin(selectedPool.pairSymbols[0]) : Coin.hbd);
	const coin1 = $derived(selectedPool ? detectCoin(selectedPool.pairSymbols[1]) : Coin.btc);

	// Detect if this is a BTC/HBD pool
	const isBtcHbdPool = $derived(
		[coin0.value, coin1.value].includes(Coin.btc.value) &&
			[coin0.value, coin1.value].includes(Coin.hbd.value)
	);

	function getMaxForCoin(
		c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc
	): CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc> | undefined {
		if (c.value === Coin.btc.value) return new CoinAmount($accountBalance.bal.btc, Coin.btc, true);
		if (c.value === Coin.hbd.value) return new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true);
		return new CoinAmount($accountBalance.bal.hive, Coin.hive, true);
	}

	// For BTC/HBD pools amount0Ca is forced to HBD and amount1Ca to BTC
	// in onPoolChange, so the balance checks must follow the actual
	// amount coin, not the pool's alphabetical coin0/coin1 ordering.
	const maxAmount0 = $derived(
		selectedPool ? getMaxForCoin(isBtcHbdPool ? Coin.hbd : coin0) : undefined
	);
	const maxAmount1 = $derived(
		selectedPool ? getMaxForCoin(isBtcHbdPool ? Coin.btc : coin1) : undefined
	);

	const exceed0 = $derived(maxAmount0 ? amount0Ca.amount > maxAmount0.amount : false);
	const exceed1 = $derived(maxAmount1 ? amount1Ca.amount > maxAmount1.amount : false);
	const hasError = $derived(exceed0 || exceed1);

	// --- Reserve-based mirroring ---
	// Pool reserves come from PoolRow as raw smallest-units values
	// (reserve{0,1}Raw already pre-scaled by 10^decimals{0,1}). Map the
	// input coin to its reserve, compute the display-units ratio, and
	// use CoinAmount.mulTo to get the mirror value in the output coin.
	function reserveForCoin(
		pool: PoolRow,
		c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc
	): { raw: number; decimals: number } {
		const c0 = detectCoin(pool.pairSymbols[0]);
		if (c.value === c0.value) {
			return { raw: pool.reserve0Raw, decimals: pool.decimals0 };
		}
		return { raw: pool.reserve1Raw, decimals: pool.decimals1 };
	}
	function usdPriceForCoin(
		pool: PoolRow,
		c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc
	): number {
		const c0 = detectCoin(pool.pairSymbols[0]);
		return c.value === c0.value ? pool.usdPrice0 : pool.usdPrice1;
	}
	function computeMirror<Out extends typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>(
		pool: PoolRow,
		input: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>,
		outCoin: Out
	): CoinAmount<Out> {
		if (input.amount === 0) return new CoinAmount(0, outCoin);
		const rIn = reserveForCoin(pool, input.coin);
		const rOut = reserveForCoin(pool, outCoin);
		// Brand-new pool with no liquidity on either side: fall back to
		// USD prices so the first LP can still seed the ratio. A pool with
		// only one empty side is degenerate and left to fail (returns 0).
		if (rIn.raw === 0 && rOut.raw === 0) {
			const usdIn = usdPriceForCoin(pool, input.coin);
			const usdOut = usdPriceForCoin(pool, outCoin);
			if (usdIn === 0 || usdOut === 0) return new CoinAmount(0, outCoin);
			return input.mulTo(usdIn / usdOut, outCoin);
		}
		const rInDisplay = rIn.raw / 10 ** rIn.decimals;
		const rOutDisplay = rOut.raw / 10 ** rOut.decimals;
		if (rInDisplay === 0) return new CoinAmount(0, outCoin);
		return input.mulTo(rOutDisplay / rInDisplay, outCoin);
	}

	let isSyncing = $state(false);
	let lastKey0 = $state('');
	let lastKey1 = $state('');
	function keyOf(ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>): string {
		return `${ca.coin.value}:${ca.amount}`;
	}
	function syncFromSource(source: '0' | '1') {
		if (!selectedPool) return;
		if (isSyncing) return;
		isSyncing = true;
		try {
			if (source === '0') {
				amount1Ca = computeMirror(selectedPool, amount0Ca, amount1Ca.coin);
			} else {
				amount0Ca = computeMirror(selectedPool, amount1Ca, amount0Ca.coin);
			}
			// Pre-seed the keys to the post-sync values so the effect that
			// fires next doesn't see the synced side as "user-edited" and
			// bounce the mirror back, losing precision.
			lastKey0 = keyOf(amount0Ca);
			lastKey1 = keyOf(amount1Ca);
		} finally {
			isSyncing = false;
		}
	}
	$effect(() => {
		if (!selectedPool || isSyncing) return;
		const key0 = keyOf(amount0Ca);
		const key1 = keyOf(amount1Ca);
		const changed0 = key0 !== lastKey0;
		const changed1 = key1 !== lastKey1;
		// BTC/HBD pools lock the BTC side as read-only, so only changes on
		// the HBD side (slot 0) should drive the mirror.
		if (changed0 && (!changed1 || isBtcHbdPool)) {
			lastKey0 = key0;
			lastKey1 = key1;
			syncFromSource('0');
		} else if (changed1 && !changed0) {
			lastKey0 = key0;
			lastKey1 = key1;
			syncFromSource('1');
		} else {
			lastKey0 = key0;
			lastKey1 = key1;
		}
	});

	$effect(() => {
		liquidityDraftStore.set({
			selectedPool,
			amount0Ca,
			amount1Ca,
			coin0,
			coin1,
			hasError,
			notInParity: false,
			exceed0,
			exceed1
		});
		editStage(!!selectedPool && amount0Ca.amount > 0 && amount1Ca.amount > 0 && !hasError);
	});
</script>

<div class="add-liquidity-form">
	<div class="field">
		<span class="label">Pool</span>
		<Select
			items={poolOptions}
			initial={initialPoolId}
			styleType="dropdown"
			placeholder="Select pool"
			onValueChange={onPoolChange}
		/>
	</div>

	{#if selectedPool}
		<div class="form-section">
			<!-- Token 0 — always editable. For BTC/HBD pools this is the
				HBD side regardless of the pool's alphabetical ordering. -->
			<div class="asset-card">
				<div class="asset-header">
					<div class="label">
						{isBtcHbdPool ? displayUnitForCoin(Coin.hbd) : selectedPool.pairSymbols[0]}
					</div>
					<!-- {#if maxAmount0}
						<span class="balance-info">Balance: {maxAmount0.toPrettyString()}</span>
					{/if} -->
				</div>
				<AmountInput
					bind:coinAmount={amount0Ca}
					coinOpts={[{ coin: isBtcHbdPool ? Coin.hbd : coin0, network: Network.magi }]}
					maxAmount={maxAmount0}
					styleType="normal"
					hideUnit
					hideNetwork
				/>
				<!-- {#if exceed0}
					<span class="error-text">Amount exceeds available balance</span>
				{/if} -->
			</div>

			{#if isBtcHbdPool}
				<!-- BTC side: editable so users can type / Max directly
					on BTC; the sync effect mirrors the paired HBD amount
					whenever BTC is the changed side. -->
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">BTC</div>
					</div>
					<AmountInput
						bind:coinAmount={amount1Ca}
						coinOpts={[{ coin: Coin.btc, network: Network.magi }]}
						maxAmount={maxAmount1}
						styleType="normal"
						hideUnit
						hideNetwork
					/>
				</div>
			{:else}
				<!-- Token 1 — editable for non-BTC pools -->
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">{selectedPool.pairSymbols[1]}</div>
						<!-- {#if maxAmount1}
							<span class="balance-info">Balance: {maxAmount1.toPrettyString()}</span>
						{/if} -->
					</div>
					<AmountInput
						bind:coinAmount={amount1Ca}
						coinOpts={[{ coin: coin1, network: Network.magi }]}
						maxAmount={maxAmount1}
						styleType="normal"
						hideUnit
						hideNetwork
					/>
					<!-- {#if exceed1}
						<span class="error-text">Amount exceeds available balance</span>
					{/if} -->
				</div>
			{/if}

			<div class="rate-info">
				<p>1 {selectedPool.pairSymbols[0]} = {selectedPool.priceRatio}</p>
				<p>1 {selectedPool.pairSymbols[1]} = {selectedPool.priceInverse}</p>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.add-liquidity-form {
		min-width: 28rem;
		max-width: 100%;
		box-sizing: border-box;
		min-height: 18rem;
		font-family: 'Nunito Sans', sans-serif;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		position: relative;
		z-index: 10;
	}
	.label {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
	}
	.form-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.asset-card {
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 16px;
		padding: 0.75rem;
		padding-bottom: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow: visible;
	}
	.asset-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.error-text {
		color: var(--dash-accent-red);
		font-size: var(--text-xs);
		font-family: 'Nunito Sans', sans-serif;
	}
	.balance-info {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
	}
	.rate-info {
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 16px;
		padding: 0.75rem 1rem;
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
		p {
			margin: 0.2rem 0;
		}
	}
</style>
