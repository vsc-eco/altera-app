<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import { liquidityDraftStore } from '$lib/pools/liquidityStore';
	import { untrack } from 'svelte';

	let { editStage, pools = [] }: { editStage: (complete: boolean) => void; pools: PoolRow[] } = $props();

	let selectedPool = $state<PoolRow | null>(null);
	let amount0Ca = $state(new CoinAmount(0, Coin.hbd));
	let amount1Ca = $state(new CoinAmount(0, Coin.btc));

	const poolOptions = $derived(pools.map((p) => ({ value: p.id, label: p.pair })));

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		const pool = pools.find((p) => p.id === id) ?? null;
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
		btcDisplayStr = '';
	}

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

	function getMaxForCoin(c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc): CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc> | undefined {
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

	// --- BTC/HBD pool: auto-calculate BTC from HBD ---
	let btcDisplayStr = $state('');

	// By the onPoolChange convention, amount0Ca is always the HBD side
	// and amount1Ca is always the BTC side for BTC/HBD pools. The effect
	// depends only on the HBD amount; reads of the BTC side happen in
	// `untrack` so the write below does not re-trigger this effect
	// (which would loop forever on every new CoinAmount object reference).
	$effect(() => {
		if (!selectedPool || !isBtcHbdPool) return;
		const hbdAmount = amount0Ca.amount;

		if (hbdAmount === 0) {
			btcDisplayStr = '';
			untrack(() => {
				if (amount1Ca.amount !== 0 || amount1Ca.coin.value !== Coin.btc.value) {
					amount1Ca = new CoinAmount(0, Coin.btc);
				}
			});
			return;
		}

		amount0Ca.convertTo(Coin.btc, Network.lightning).then((btcAmt) => {
			btcDisplayStr = btcAmt.toAmountString();
			untrack(() => {
				if (amount1Ca.amount === btcAmt.amount && amount1Ca.coin.value === btcAmt.coin.value) {
					return;
				}
				amount1Ca = btcAmt as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>;
			});
		});
	});

	// --- Non BTC/HBD pools: sync via conversion ---
	const USD_TOLERANCE = 0.005;
	let usdDiff = $state(0);
	$effect(() => {
		if (!selectedPool || isBtcHbdPool) {
			usdDiff = 0;
			return;
		}
		Promise.all([
			amount0Ca.convertTo(Coin.usd, Network.lightning),
			amount1Ca.convertTo(Coin.usd, Network.lightning)
		]).then(([usd0, usd1]) => {
			usdDiff = Math.abs(usd0.toNumber() - usd1.toNumber());
		});
	});
	const notInParity = $derived(!isBtcHbdPool && usdDiff > USD_TOLERANCE);
	const hasError = $derived(exceed0 || exceed1 || notInParity);

	let isSyncing = $state(false);
	let lastKey0 = $state('');
	let lastKey1 = $state('');
	function keyOf(ca: CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>): string {
		return `${ca.coin.value}:${ca.amount}`;
	}
	async function syncFromSource(source: '0' | '1') {
		if (!selectedPool || isBtcHbdPool) return;
		if (isSyncing) return;
		isSyncing = true;
		try {
			if (source === '0') {
				const next =
					amount0Ca.amount === 0
						? new CoinAmount(0, coin1)
						: ((await amount0Ca.convertTo(
								coin1,
								Network.lightning
							)) as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>);
				amount1Ca = next;
			} else {
				const next =
					amount1Ca.amount === 0
						? new CoinAmount(0, coin0)
						: ((await amount1Ca.convertTo(
								coin0,
								Network.lightning
							)) as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>);
				amount0Ca = next;
			}
			// Pre-seed the keys to the post-sync values so the effect that
			// fires next doesn't see the synced side as "user-edited" and
			// bounce the conversion back, losing precision.
			lastKey0 = keyOf(amount0Ca);
			lastKey1 = keyOf(amount1Ca);
		} finally {
			isSyncing = false;
		}
	}
	$effect(() => {
		if (!selectedPool || isSyncing || isBtcHbdPool) return;
		const key0 = keyOf(amount0Ca);
		const key1 = keyOf(amount1Ca);
		const changed0 = key0 !== lastKey0;
		const changed1 = key1 !== lastKey1;
		if (changed0 && !changed1) {
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
			notInParity,
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
					{#if exceed0}
						<span class="error-text"
							>Exceeds Magi {isBtcHbdPool ? displayUnitForCoin(Coin.hbd) : displayUnitForCoin(coin0)} balance</span
						>
					{/if}
				</div>
				<AmountInput
					bind:coinAmount={amount0Ca}
					coinOpts={[{ coin: isBtcHbdPool ? Coin.hbd : coin0, network: Network.magi }]}
					maxAmount={maxAmount0}
					styleType="normal"
					hideUnit
					hideNetwork
				/>
			</div>

			{#if isBtcHbdPool}
				<!-- BTC side: read-only auto-calculated field -->
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">BTC (auto-calculated)</div>
						{#if exceed1}
							<span class="error-text">Exceeds Magi BTC balance</span>
						{/if}
						{#if maxAmount1}
							<span class="balance-info">Balance: {maxAmount1.toPrettyString()}</span>
						{/if}
					</div>
					<div class="btc-input-mirror">
						<img src="/btc/btc.svg" alt="BTC" class="btc-coin-icon" />
						<span class="btc-value">{btcDisplayStr || '0'}</span>
						<span class="btc-unit">BTC</span>
					</div>
				</div>
			{:else}
				<!-- Token 1 — editable for non-BTC pools -->
				<div class="asset-card">
					<div class="asset-header">
						<div class="label">{selectedPool.pairSymbols[1]}</div>
						{#if exceed1}
							<span class="error-text">Exceeds Magi {displayUnitForCoin(coin1)} balance</span>
						{/if}
					</div>
					<AmountInput
						bind:coinAmount={amount1Ca}
						coinOpts={[{ coin: coin1, network: Network.magi }]}
						maxAmount={maxAmount1}
						styleType="normal"
						hideUnit
						hideNetwork
					/>
				</div>
			{/if}

			<div class="rate-info">
				<p>1 {selectedPool.pairSymbols[0]} = {selectedPool.priceRatio}</p>
				<p>1 {selectedPool.pairSymbols[1]} = {selectedPool.priceInverse}</p>
			</div>
			{#if notInParity}
				<p class="error-text">Token A and Token B must have equal USD value to add liquidity.</p>
			{/if}
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
	.btc-input-mirror {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.25);
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		min-height: 2.5rem;
		box-sizing: border-box;
		.btc-coin-icon {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 50%;
		}
		.btc-value {
			flex: 1;
			font-family: 'Nunito Sans', sans-serif;
			color: var(--dash-text-primary);
		}
		.btc-unit {
			font-weight: 500;
			color: var(--dash-text-muted);
			font-family: 'Nunito Sans', sans-serif;
		}
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
