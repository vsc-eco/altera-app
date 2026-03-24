<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import type { PoolRow } from '$lib/pools/poolsData';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getHiveAssetName, getHbdAssetName } from '$lib/../client';
	import { liquidityDraftStore } from '$lib/pools/liquidityStore';

	let { editStage, pools = [] }: { editStage: (complete: boolean) => void; pools: PoolRow[] } = $props();

	let selectedPool = $state<PoolRow | null>(null);
	let amount0Ca = $state(new CoinAmount(0, Coin.hbd));
	let amount1Ca = $state(new CoinAmount(0, Coin.btc));

	const poolOptions = $derived(pools.map((p) => ({ value: p.id, label: p.pair })));

	function onPoolChange(details: { value: string[] }) {
		const id = details.value[0];
		selectedPool = pools.find((p) => p.id === id) ?? null;
		amount0Ca = new CoinAmount(0, Coin.hbd);
		amount1Ca = new CoinAmount(0, Coin.btc);
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

	function getMaxForCoin(c: typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc): CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc> | undefined {
		if (c.value === Coin.btc.value) return new CoinAmount($accountBalance.bal.btc, Coin.btc, true);
		if (c.value === Coin.hbd.value) return new CoinAmount($accountBalance.bal.hbd, Coin.hbd, true);
		return new CoinAmount($accountBalance.bal.hive, Coin.hive, true);
	}

	const maxAmount0 = $derived(selectedPool ? getMaxForCoin(coin0) : undefined);
	const maxAmount1 = $derived(selectedPool ? getMaxForCoin(coin1) : undefined);

	const exceed0 = $derived(maxAmount0 ? amount0Ca.amount > maxAmount0.amount : false);
	const exceed1 = $derived(maxAmount1 ? amount1Ca.amount > maxAmount1.amount : false);

	const USD_TOLERANCE = 0.005;
	let usdDiff = $state(0);
	$effect(() => {
		if (!selectedPool) {
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
	const notInParity = $derived(usdDiff > USD_TOLERANCE);
	const hasError = $derived(exceed0 || exceed1 || notInParity);

	let isSyncing = $state(false);
	let lastKey0 = $state('');
	let lastKey1 = $state('');
	async function syncFromSource(source: '0' | '1') {
		if (!selectedPool) return;
		if (isSyncing) return;
		isSyncing = true;
		try {
			if (source === '0') {
				if (amount0Ca.amount === 0) {
					amount1Ca = new CoinAmount(0, coin1);
				} else {
					amount1Ca = (await amount0Ca.convertTo(
						coin1,
						Network.lightning
					)) as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>;
				}
			} else {
				if (amount1Ca.amount === 0) {
					amount0Ca = new CoinAmount(0, coin0);
				} else {
					amount0Ca = (await amount1Ca.convertTo(
						coin0,
						Network.lightning
					)) as CoinAmount<typeof Coin.hive | typeof Coin.hbd | typeof Coin.btc>;
				}
			}
		} finally {
			isSyncing = false;
		}
	}
	$effect(() => {
		if (!selectedPool || isSyncing) return;
		const key0 = `${amount0Ca.coin.value}:${amount0Ca.amount}`;
		const key1 = `${amount1Ca.coin.value}:${amount1Ca.amount}`;
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
			<div class="asset-card">
				<div class="asset-header">
					<div class="label">{selectedPool.pairSymbols[0]}</div>
					{#if exceed0}
						<span class="error-text">Exceeds Magi {displayUnitForCoin(coin0)} balance</span>
					{/if}
				</div>
				<AmountInput
					bind:coinAmount={amount0Ca}
					coinOpts={[{ coin: coin0, network: Network.magi }]}
					maxAmount={maxAmount0}
					styleType="normal"
				/>
			</div>

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
				/>
			</div>

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
	.add-liquidity-form { min-width: 28rem; max-width: 100%; box-sizing: border-box; }
	.field { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
	.label { font-size: 14px; color: var(--neutral-fg-mid); display: flex; align-items: center; gap: 0.5rem; }
	.form-section { display: flex; flex-direction: column; gap: 1.25rem; }
	.asset-card { background: var(--neutral-bg); border: 1px solid var(--neutral-bg-accent); border-radius: 0.9rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
	.asset-header { display: flex; justify-content: space-between; align-items: center; }
	.error-text { color: var(--secondary-fg-mid); font-size: 11px; }
	.rate-info { background: var(--neutral-bg); border: 1px solid var(--neutral-bg-accent); border-radius: 0.8rem; padding: 0.75rem 1rem; font-size: 14px; color: var(--neutral-fg-mid); }
</style>

