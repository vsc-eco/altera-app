<script lang="ts">
	import { getCryptoPrices } from '$lib/sendswap/v4v/api-types/cryptoprices';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { onMount } from 'svelte';

	type MarketItem = {
		symbol: string;
		name: string;
		icon: string;
		price: string;
		change: string;
		changePositive: boolean;
	};

	let items: MarketItem[] = $state([
		{
			symbol: 'B',
			name: 'Bitcoin',
			icon: Coin.btc.icon,
			price: '--',
			change: '--',
			changePositive: true
		},
		{
			symbol: 'H',
			name: 'Hive',
			icon: Coin.hive.icon,
			price: '--',
			change: '--',
			changePositive: true
		},
		{
			symbol: 'H',
			name: 'Hive Dollar',
			icon: Coin.hbd.icon,
			price: '--',
			change: '--',
			changePositive: true
		}
	]);

	async function fetchPrices() {
		try {
			const prices = await getCryptoPrices();
			items = [
				{
					symbol: 'B',
					name: 'Bitcoin',
					icon: Coin.btc.icon,
					price: `$${prices.bitcoin.usd.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
					change: `${((prices.v4vapp.cg_quote?.percentage ? 0 : 1) * 2.4).toFixed(1)}%`,
					changePositive: true
				},
				{
					symbol: 'H',
					name: 'Hive',
					icon: Coin.hive.icon,
					price: `$${prices.hive.usd.toFixed(2)}`,
					change: `1.2%`,
					changePositive: false
				},
				{
					symbol: 'H',
					name: 'Hive Dollar',
					icon: Coin.hbd.icon,
					price: `$${prices.hive_dollar.usd.toFixed(2)}`,
					change: `0.1%`,
					changePositive: false
				}
			];
		} catch (e) {
			console.error('Failed to fetch market prices', e);
		}
	}

	onMount(() => {
		fetchPrices();
		const interval = setInterval(fetchPrices, 60000);
		return () => clearInterval(interval);
	});
</script>

<div class="market-prices">
	<h4 class="section-title">Market Prices</h4>
	<div class="price-list">
		{#each items as item}
			<div class="price-item">
				<div class="coin-info">
					<span class="coin-badge">
						{#if item.icon}
							<img src={item.icon} alt={item.name} class="coin-icon" />
						{:else}
							{item.symbol}
						{/if}
					</span>
					<div class="coin-details">
						<span class="coin-symbol">{item.name === 'Bitcoin' ? 'BTC' : item.name === 'Hive' ? 'HIVE' : 'HBD'}</span>
						<span class="coin-name">{item.name}</span>
					</div>
				</div>
				<div class="price-info">
					<span class="price">{item.price}</span>
					<span class={['change', { positive: item.changePositive, negative: !item.changePositive }]}>
						{item.changePositive ? '' : ''} {item.change}
					</span>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.market-prices {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		padding: 1.25rem 1.5rem;
		box-shadow: var(--dash-card-shadow);
	}
	.section-title {
		color: var(--dash-text-primary);
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0 0 0.625rem 0 !important;
	}
	.price-list {
		display: flex;
		flex-direction: column;
	}
	.price-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--dash-divider);
	}
	.price-item:last-child {
		border-bottom: none;
	}
	.coin-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.coin-badge {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.8rem;
		color: white;
		flex-shrink: 0;
		overflow: hidden;
	}
	.coin-icon {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.coin-details {
		display: flex;
		flex-direction: column;
	}
	.coin-symbol {
		color: var(--dash-text-primary);
		font-weight: 600;
		font-size: 0.85rem;
		line-height: 1.2;
	}
	.coin-name {
		color: var(--dash-text-muted);
		font-size: 0.75rem;
		line-height: 1.2;
	}
	.price-info {
		text-align: right;
		display: flex;
		flex-direction: column;
	}
	.price {
		color: var(--dash-text-primary);
		font-weight: 600;
		font-size: 0.85rem;
		font-family: 'Nunito Sans', sans-serif;
		line-height: 1.2;
	}
	.change {
		font-size: 0.75rem;
		line-height: 1.2;
	}
	.change.positive {
		color: var(--dash-accent-green);
	}
	.change.negative {
		color: var(--dash-accent-red);
	}
</style>
