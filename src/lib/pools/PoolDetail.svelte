<script lang="ts">
	import Tabs from '$lib/zag/Tabs.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import type { PoolRow } from './poolsData';
	import moment from 'moment';

	let {
		pool,
		onback
	}: {
		pool: PoolRow;
		onback: () => void;
	} = $props();

	const HASURA_URL = 'https://magidev.okinoko.io/hasura/v1/graphql';
	const poolId = pool.contractId;
	const sym0 = pool.pairSymbols[0];
	const sym1 = pool.pairSymbols[1];

	type SwapEvent = {
		indexer_tx_hash: string;
		indexer_block_height: number;
		indexer_ts: string;
		asset_in: string;
		asset_out: string;
		amount_in: number;
		amount_out: number;
		recipient: string;
	};

	type AddLiqEvent = {
		indexer_tx_hash: string;
		indexer_block_height: number;
		indexer_ts: string;
		provider: string;
		amount0: number;
		amount1: number;
		lp_minted: number;
	};

	type RemoveLiqEvent = {
		indexer_tx_hash: string;
		indexer_block_height: number;
		indexer_ts: string;
		provider: string;
		amount0: number;
		amount1: number;
		lp_burned: number;
	};

	let swaps = $state<SwapEvent[]>([]);
	let adds = $state<AddLiqEvent[]>([]);
	let removes = $state<RemoveLiqEvent[]>([]);
	let loadingSwaps = $state(true);
	let loadingAdds = $state(true);
	let loadingRemoves = $state(true);

	async function hasuraFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
		const res = await fetch(HASURA_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query, variables })
		});
		const json = await res.json();
		return json.data;
	}

	$effect(() => {
		loadingSwaps = true;
		hasuraFetch<{ dex_pool_swap_events: SwapEvent[] }>(
			`query RecentSwaps($pool: String!, $limit: Int) {
				dex_pool_swap_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					asset_in asset_out amount_in amount_out recipient
				}
			}`,
			{ pool: poolId, limit: 20 }
		).then((data) => {
			swaps = data?.dex_pool_swap_events ?? [];
			loadingSwaps = false;
		});

		loadingAdds = true;
		hasuraFetch<{ dex_pool_add_liq_events: AddLiqEvent[] }>(
			`query RecentAddLiquidity($pool: String!, $limit: Int) {
				dex_pool_add_liq_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					provider amount0 amount1 lp_minted
				}
			}`,
			{ pool: poolId, limit: 20 }
		).then((data) => {
			adds = data?.dex_pool_add_liq_events ?? [];
			loadingAdds = false;
		});

		loadingRemoves = true;
		hasuraFetch<{ dex_pool_rem_liq_events: RemoveLiqEvent[] }>(
			`query RecentRemoveLiquidity($pool: String!, $limit: Int) {
				dex_pool_rem_liq_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					provider amount0 amount1 lp_burned
				}
			}`,
			{ pool: poolId, limit: 20 }
		).then((data) => {
			removes = data?.dex_pool_rem_liq_events ?? [];
			loadingRemoves = false;
		});
	});

	function decimalsForAsset(symbol: string): number {
		return symbol?.toUpperCase() === 'BTC' ? 8 : 3;
	}

	function fmtAmt(raw: number, decimals = 3): string {
		const val = raw / 10 ** decimals;
		return val.toLocaleString(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
	}

	function fmtDate(ts: string): string {
		return moment(ts).format('MMM DD');
	}

	function shortAddr(addr: string): string {
		if (!addr) return '-';
		// Strip hive: prefix for display
		const display = addr.startsWith('hive:') ? addr.slice(5) : addr;
		return display.length > 14 ? `${display.slice(0, 6)}...${display.slice(-4)}` : display;
	}
</script>

<div class="pool-detail">
	<div class="header">
		<PillButton onclick={onback} styleType="icon-subtle">
			<ArrowLeft size="24" />
		</PillButton>
		<h4>{pool.pair}</h4>
	</div>

	<div class="summary">
		<div class="stat">
			<span class="stat-label">Price</span>
			<span class="stat-value">{pool.priceRatio}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Liquidity</span>
			<span class="stat-value">{pool.totalLiquidityUsd}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Volume</span>
			<span class="stat-value">{pool.volumeUsd}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Fees</span>
			<span class="stat-value">{pool.feeEarnedUsd}</span>
		</div>
	</div>

	<Tabs
		items={[
			{
				value: 'swaps',
				label: 'Recent Swaps',
				content: swapsContent
			},
			{
				value: 'adds',
				label: 'Add Liquidity',
				content: addsContent
			},
			{
				value: 'removes',
				label: 'Remove Liquidity',
				content: removesContent
			}
		]}
	/>
</div>

{#snippet skeletonRows(cols: number, count?: number)}
	{#each Array(count ?? 8) as _}
		<tr class="skeleton-row">
			{#each Array(cols) as _c}
				<td><div class="skeleton-cell"></div></td>
			{/each}
		</tr>
	{/each}
{/snippet}

{#snippet emptyOverlay(msg: string)}
	<div class="empty-overlay">
		<div class="empty-message">{msg}</div>
	</div>
{/snippet}

{#snippet swapsContent()}
	<div class="tab-content">
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Recipient</th>
						<th class="amount-header">Amount In</th>
						<th>Token</th>
						<th class="amount-header">Amount Out</th>
						<th>Token</th>
						<th>Tx Hash</th>
					</tr>
				</thead>
				<tbody>
					{#if swaps.length > 0}
						{#each swaps as s}
							<tr class="data-row">
								<td class="date-cell">{fmtDate(s.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={s.recipient}>{shortAddr(s.recipient)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(s.amount_in, decimalsForAsset(s.asset_in))}</td>
								<td class="token-cell">{s.asset_in?.toUpperCase() ?? '-'}</td>
								<td class="amount-cell mono">{fmtAmt(s.amount_out, decimalsForAsset(s.asset_out))}</td>
								<td class="token-cell">{s.asset_out?.toUpperCase() ?? '-'}</td>
								<td class="tx-cell">
									<Clipboard value={s.indexer_tx_hash} label="" disabled={false} />
								</td>
							</tr>
						{/each}
					{/if}
					{#if loadingSwaps}
						{@render skeletonRows(7)}
					{/if}
				</tbody>
			</table>
			{#if !loadingSwaps && swaps.length === 0}
				{@render emptyOverlay('No swap events found')}
			{/if}
		</div>
	</div>
{/snippet}

{#snippet addsContent()}
	<div class="tab-content">
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Provider</th>
						<th class="amount-header">{sym0}</th>
						<th class="amount-header">{sym1}</th>
						<th class="amount-header">LP Minted</th>
						<th>Tx Hash</th>
					</tr>
				</thead>
				<tbody>
					{#if adds.length > 0}
						{#each adds as a}
							<tr class="data-row">
								<td class="date-cell">{fmtDate(a.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={a.provider}>{shortAddr(a.provider)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(a.amount0, decimalsForAsset(sym0))}</td>
								<td class="amount-cell mono">{fmtAmt(a.amount1, decimalsForAsset(sym1))}</td>
								<td class="amount-cell mono">{fmtAmt(a.lp_minted)}</td>
								<td class="tx-cell">
									<Clipboard value={a.indexer_tx_hash} label="" disabled={false} />
								</td>
							</tr>
						{/each}
					{/if}
					{#if loadingAdds}
						{@render skeletonRows(6)}
					{/if}
				</tbody>
			</table>
			{#if !loadingAdds && adds.length === 0}
				{@render emptyOverlay('No add liquidity events found')}
			{/if}
		</div>
	</div>
{/snippet}

{#snippet removesContent()}
	<div class="tab-content">
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Provider</th>
						<th class="amount-header">{sym0}</th>
						<th class="amount-header">{sym1}</th>
						<th class="amount-header">LP Burned</th>
						<th>Tx Hash</th>
					</tr>
				</thead>
				<tbody>
					{#if removes.length > 0}
						{#each removes as r}
							<tr class="data-row">
								<td class="date-cell">{fmtDate(r.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={r.provider}>{shortAddr(r.provider)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(r.amount0, decimalsForAsset(sym0))} {sym0}</td>
								<td class="amount-cell mono">{fmtAmt(r.amount1, decimalsForAsset(sym1))} {sym1}</td>
								<td class="amount-cell mono">{fmtAmt(r.lp_burned)}</td>
								<td class="tx-cell">
									<Clipboard value={r.indexer_tx_hash} label="" disabled={false} />
								</td>
							</tr>
						{/each}
					{/if}
					{#if loadingRemoves}
						{@render skeletonRows(6)}
					{/if}
				</tbody>
			</table>
			{#if !loadingRemoves && removes.length === 0}
				{@render emptyOverlay('No remove liquidity events found')}
			{/if}
		</div>
	</div>
{/snippet}

<style lang="scss">
	.pool-detail {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 1rem;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.75rem;

		h4 {
			margin: 0;
			font-size: 1.1rem;
			font-weight: 600;
			color: var(--neutral-fg);
		}
	}

	.summary {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;

		.stat {
			flex: 1;
			min-width: 120px;
			padding: 0.75rem 1rem;
			border-radius: 0.5rem;
			background-color: var(--neutral-off-bg);
			border: 1px solid var(--neutral-bg-accent-shifted);

			.stat-label {
				display: block;
				font-size: var(--text-xs);
				color: var(--neutral-fg-mid);
				margin-bottom: 0.25rem;
			}

			.stat-value {
				display: block;
				font-weight: 600;
				color: var(--neutral-fg);
				font-size: var(--text-sm);
			}
		}
	}

	.tab-content {
		padding-top: 0.75rem;
	}

	/* Match Transaction table's .scroll wrapper */
	.scroll {
		overflow: auto;
		width: 100%;
		flex-grow: 1;
		position: relative;
	}

	table {
		width: 100%;
		border-spacing: 1rem 0.5rem;
		border-collapse: collapse;
		position: relative;
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: var(--neutral-bg);
	}

	th {
		text-align: left;
		min-width: max-content;
		box-sizing: content-box;
		padding: 0.5rem min(1rem, 2%);
		color: var(--neutral-fg-mid);
		font-weight: 500;
		white-space: nowrap;
	}

	/* Match Transaction table td styling */
	:global(.pool-detail) td {
		vertical-align: middle;
		width: max-content;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}

	.amount-header {
		text-align: right;
		padding-right: 1rem;
	}

	/* Row styles matching Transaction Tr.svelte */
	.data-row {
		cursor: default;
		transition: background-color 0.15s;

		&:hover {
			background-color: var(--neutral-bg-accent);
		}
	}

	.date-cell {
		padding: 1rem min(1rem, 2%);
		min-width: 4rem;
		white-space: nowrap;
		color: var(--neutral-fg);
	}

	.addr-cell {
		padding: 1rem min(1rem, 2%);

		.addr {
			font-family: 'Noto Sans Mono Variable', monospace;
			font-size: var(--text-sm);
			color: var(--neutral-fg);
		}
	}

	.amount-cell {
		text-align: right;
		padding: 1rem min(1rem, 2%);
		padding-right: 1rem;
		color: var(--neutral-fg);
	}

	.token-cell {
		padding: 1rem min(1rem, 2%);
		padding-left: 0;
		font-weight: 500;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
	}

	.tx-cell {
		padding: 0.5rem min(1rem, 2%);
		max-width: 10rem;

		:global([data-part='control']) {
			gap: 0.15rem;
		}

		:global(input) {
			min-width: 6ch;
			width: 100%;
			font-size: var(--text-xs);
			padding: 0.25rem 0.35rem;
			height: 1.75rem;
			border: none;
			outline: none;
			background: transparent;
		}

		:global(button) {
			padding: 0.2rem;
			height: 1.75rem;
			width: 1.75rem;
		}
	}

	.mono {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-weight: 400;
	}

	/* Skeleton loading — matches Transaction Table.svelte */
	.skeleton-cell {
		background-color: var(--neutral-bg-accent);
		border-radius: 0.5rem;
		height: 3rem;
		margin: 0.75rem 1rem;
		animation: pulse 2s ease-in-out infinite;
	}

	.empty-overlay {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 0;
	}

	.empty-message {
		font-weight: 500;
		color: var(--neutral-fg-mid);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
