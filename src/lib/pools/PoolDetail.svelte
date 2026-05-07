<script lang="ts">
	import Tabs from '$lib/zag/Tabs.svelte';
	import { ArrowLeft, Plus, Minus } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import type { PoolRow, MyPoolRow } from './poolsData';
	import { getMagiIndexerUrl } from '../../client';
	import moment from 'moment';
	import AddLiquidityPopup from './AddLiquidityPopup.svelte';
	import RemoveLiquidityPopup from './RemoveLiquidityPopup.svelte';
	import { untrack } from 'svelte';
	import SidePopup from '$lib/components/SidePopup.svelte';
	import { ExternalLink } from '@lucide/svelte';
	import { getVscExplorerTxUrl } from '$lib/constants';

	let {
		pool,
		onback,
		pools = [],
		myPools = []
	}: {
		pool: PoolRow;
		onback: () => void;
		pools?: PoolRow[];
		myPools?: MyPoolRow[];
	} = $props();

	let addLiquidityOpen = $state(false);
	let removeLiquidityOpen = $state(false);
	const hasUserPosition = $derived(myPools.some((p) => p.contractId === pool.contractId));

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

	const PAGE_SIZE = 20;
	let swaps = $state<SwapEvent[]>([]);
	let adds = $state<AddLiqEvent[]>([]);
	let removes = $state<RemoveLiqEvent[]>([]);
	let loadingSwaps = $state(true);
	let loadingAdds = $state(true);
	let loadingRemoves = $state(true);
	// `hasMore*` gets flipped off when a page returns fewer than
	// PAGE_SIZE rows, so the scroll handler stops firing follow-up
	// requests once we've seen the tail.
	let hasMoreSwaps = $state(true);
	let hasMoreAdds = $state(true);
	let hasMoreRemoves = $state(true);

	async function hasuraFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
		const res = await fetch(getMagiIndexerUrl(), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query, variables })
		});
		const json = await res.json();
		return json.data;
	}

	async function loadSwaps(mode: 'set' | 'extend') {
		if (loadingSwaps) return;
		if (mode === 'extend' && !hasMoreSwaps) return;
		loadingSwaps = true;
		const data = await hasuraFetch<{ dex_pool_swap_events: SwapEvent[] }>(
			`query RecentSwaps($pool: String!, $limit: Int, $offset: Int) {
				dex_pool_swap_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
					offset: $offset
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					asset_in asset_out amount_in amount_out recipient
				}
			}`,
			{ pool: poolId, limit: PAGE_SIZE, offset: mode === 'extend' ? swaps.length : 0 }
		);
		const rows = data?.dex_pool_swap_events ?? [];
		hasMoreSwaps = rows.length === PAGE_SIZE;
		swaps = mode === 'set' ? rows : swaps.concat(rows);
		loadingSwaps = false;
	}

	async function loadAdds(mode: 'set' | 'extend') {
		if (loadingAdds) return;
		if (mode === 'extend' && !hasMoreAdds) return;
		loadingAdds = true;
		const data = await hasuraFetch<{ dex_pool_add_liq_events: AddLiqEvent[] }>(
			`query RecentAddLiquidity($pool: String!, $limit: Int, $offset: Int) {
				dex_pool_add_liq_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
					offset: $offset
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					provider amount0 amount1 lp_minted
				}
			}`,
			{ pool: poolId, limit: PAGE_SIZE, offset: mode === 'extend' ? adds.length : 0 }
		);
		const rows = data?.dex_pool_add_liq_events ?? [];
		hasMoreAdds = rows.length === PAGE_SIZE;
		adds = mode === 'set' ? rows : adds.concat(rows);
		loadingAdds = false;
	}

	async function loadRemoves(mode: 'set' | 'extend') {
		if (loadingRemoves) return;
		if (mode === 'extend' && !hasMoreRemoves) return;
		loadingRemoves = true;
		const data = await hasuraFetch<{ dex_pool_rem_liq_events: RemoveLiqEvent[] }>(
			`query RecentRemoveLiquidity($pool: String!, $limit: Int, $offset: Int) {
				dex_pool_rem_liq_events(
					where: {indexer_contract_id: {_eq: $pool}}
					order_by: {indexer_block_height: desc}
					limit: $limit
					offset: $offset
				) {
					indexer_tx_hash indexer_block_height indexer_ts
					provider amount0 amount1 lp_burned
				}
			}`,
			{ pool: poolId, limit: PAGE_SIZE, offset: mode === 'extend' ? removes.length : 0 }
		);
		const rows = data?.dex_pool_rem_liq_events ?? [];
		hasMoreRemoves = rows.length === PAGE_SIZE;
		removes = mode === 'set' ? rows : removes.concat(rows);
		loadingRemoves = false;
	}

	// Fire initial loads whenever the pool changes. Wrap the actual
	// load calls in `untrack` so the effect doesn't re-fire when the
	// loaders write `swaps`/`adds`/`removes` back into state (the
	// loaders read `.length` to compute the offset, which would
	// otherwise turn this effect into an infinite loop).
	$effect(() => {
		poolId;
		swaps = [];
		adds = [];
		removes = [];
		hasMoreSwaps = true;
		hasMoreAdds = true;
		hasMoreRemoves = true;
		loadingSwaps = false;
		loadingAdds = false;
		loadingRemoves = false;
		untrack(() => {
			loadSwaps('set');
			loadAdds('set');
			loadRemoves('set');
		});
	});

	/** Which tab is currently active in the zag Tabs instance, so
	 *  we only fire the load-more callback for the list the user is
	 *  actually looking at. */
	let activeTabValue = $state<string | null>('swaps');

	function maybeLoadMore() {
		const doc = document.documentElement;
		const nearBottom = window.innerHeight + doc.scrollTop >= doc.scrollHeight - 64;
		if (!nearBottom) return;
		if (activeTabValue === 'swaps') loadSwaps('extend');
		else if (activeTabValue === 'adds') loadAdds('extend');
		else if (activeTabValue === 'removes') loadRemoves('extend');
	}

	$effect(() => {
		window.addEventListener('scroll', maybeLoadMore, { passive: true });
		return () => window.removeEventListener('scroll', maybeLoadMore);
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

	type PoolEvent =
		| { kind: 'swap'; data: SwapEvent }
		| { kind: 'add'; data: AddLiqEvent }
		| { kind: 'remove'; data: RemoveLiqEvent };

	let selectedEvent = $state<PoolEvent | null>(null);
	let popupOpen = $state(false);

	function openEvent(event: PoolEvent) {
		selectedEvent = event;
		popupOpen = true;
	}
	function closeEvent() {
		popupOpen = false;
		selectedEvent = null;
	}
</script>

<div class="pool-detail">
	<div class="header">
		<PillButton onclick={onback} styleType="icon-subtle">
			<ArrowLeft size="24" />
		</PillButton>
		<h4>{pool.pair}</h4>
		<div class="header-actions">
			<button
				type="button"
				class="header-action header-action-primary"
				onclick={() => (addLiquidityOpen = true)}
			>
				<Plus size={14} />
				Add Liquidity
			</button>
			{#if hasUserPosition}
				<button
					type="button"
					class="header-action"
					onclick={() => (removeLiquidityOpen = true)}
				>
					<Minus size={14} />
					Remove Liquidity
				</button>
			{/if}
		</div>
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
		bind:activeTab={activeTabValue}
		items={[
			{
				value: 'swaps',
				label: 'Recent Swaps',
				content: swapsContent
			},
			{
				value: 'adds',
				label: 'Liquidity Added',
				content: addsContent
			},
			{
				value: 'removes',
				label: 'Liquidity Removed',
				content: removesContent
			}
		]}
	/>
</div>

<AddLiquidityPopup
	bind:open={addLiquidityOpen}
	pools={pools.length ? pools : [pool]}
	preselectedPool={pool}
/>
<RemoveLiquidityPopup
	bind:open={removeLiquidityOpen}
	pools={pools.length ? pools.filter((p) => myPools.some((m) => m.contractId === p.contractId)) : [pool]}
	{myPools}
	preselectedPool={pool}
/>

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
							<tr class="data-row clickable-row" onclick={() => openEvent({ kind: 'swap', data: s })}>
								<td class="date-cell">{fmtDate(s.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={s.recipient}>{shortAddr(s.recipient)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(s.amount_in, decimalsForAsset(s.asset_in))}</td>
								<td class="token-cell">{s.asset_in?.toUpperCase() ?? '-'}</td>
								<td class="amount-cell mono">{fmtAmt(s.amount_out, decimalsForAsset(s.asset_out))}</td>
								<td class="token-cell">{s.asset_out?.toUpperCase() ?? '-'}</td>
								<td class="tx-cell" onclick={(e) => e.stopPropagation()}>
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
							<tr class="data-row clickable-row" onclick={() => openEvent({ kind: 'add', data: a })}>
								<td class="date-cell">{fmtDate(a.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={a.provider}>{shortAddr(a.provider)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(a.amount0, decimalsForAsset(sym0))}</td>
								<td class="amount-cell mono">{fmtAmt(a.amount1, decimalsForAsset(sym1))}</td>
								<td class="amount-cell mono">{fmtAmt(a.lp_minted)}</td>
								<td class="tx-cell" onclick={(e) => e.stopPropagation()}>
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
							<tr class="data-row clickable-row" onclick={() => openEvent({ kind: 'remove', data: r })}>
								<td class="date-cell">{fmtDate(r.indexer_ts)}</td>
								<td class="addr-cell">
									<span class="addr" title={r.provider}>{shortAddr(r.provider)}</span>
								</td>
								<td class="amount-cell mono">{fmtAmt(r.amount0, decimalsForAsset(sym0))} {sym0}</td>
								<td class="amount-cell mono">{fmtAmt(r.amount1, decimalsForAsset(sym1))} {sym1}</td>
								<td class="amount-cell mono">{fmtAmt(r.lp_burned)}</td>
								<td class="tx-cell" onclick={(e) => e.stopPropagation()}>
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

{#snippet poolEventContent()}
	{#if selectedEvent}
		{@const e = selectedEvent}
		{@const txHash = e.data.indexer_tx_hash}
		<p class="popup-subtitle">{moment(e.data.indexer_ts).format('MMM DD, YYYY [at] H:mm')}</p>

		{#if e.kind === 'swap'}
			<div class="popup-amounts">
				<div class="popup-amount-row">
					<span class="popup-label">Amount In</span>
					<span class="mono">{fmtAmt(e.data.amount_in, decimalsForAsset(e.data.asset_in))} {e.data.asset_in?.toUpperCase() ?? ''}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">Amount Out</span>
					<span class="mono">{fmtAmt(e.data.amount_out, decimalsForAsset(e.data.asset_out))} {e.data.asset_out?.toUpperCase() ?? ''}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">Recipient</span>
					<span class="mono addr" title={e.data.recipient}>{shortAddr(e.data.recipient)}</span>
				</div>
			</div>
		{:else if e.kind === 'add'}
			<div class="popup-amounts">
				<div class="popup-amount-row">
					<span class="popup-label">{sym0}</span>
					<span class="mono">{fmtAmt(e.data.amount0, decimalsForAsset(sym0))}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">{sym1}</span>
					<span class="mono">{fmtAmt(e.data.amount1, decimalsForAsset(sym1))}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">LP Minted</span>
					<span class="mono">{fmtAmt(e.data.lp_minted)}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">Provider</span>
					<span class="mono addr" title={e.data.provider}>{shortAddr(e.data.provider)}</span>
				</div>
			</div>
		{:else}
			<div class="popup-amounts">
				<div class="popup-amount-row">
					<span class="popup-label">{sym0}</span>
					<span class="mono">{fmtAmt(e.data.amount0, decimalsForAsset(sym0))}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">{sym1}</span>
					<span class="mono">{fmtAmt(e.data.amount1, decimalsForAsset(sym1))}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">LP Burned</span>
					<span class="mono">{fmtAmt(e.data.lp_burned)}</span>
				</div>
				<div class="popup-amount-row">
					<span class="popup-label">Provider</span>
					<span class="mono addr" title={e.data.provider}>{shortAddr(e.data.provider)}</span>
				</div>
			</div>
		{/if}

		<div class="popup-section">
			<h3>Transaction ID</h3>
			<Clipboard value={txHash} label="" disabled={false} />
		</div>
		<div class="popup-section">
			<h3>External Links</h3>
			<a href={getVscExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
				VSC Block Explorer <ExternalLink size={14} />
			</a>
		</div>
	{/if}
{/snippet}

{#snippet poolEventTitle()}
	{#if selectedEvent}
		{selectedEvent.kind === 'swap' ? 'Swap' : selectedEvent.kind === 'add' ? 'Add Liquidity' : 'Remove Liquidity'}
	{/if}
{/snippet}

<SidePopup
	toggle={closeEvent}
	content={popupOpen ? poolEventContent : undefined}
	open={popupOpen}
>
	{#snippet title()}{@render poolEventTitle()}{/snippet}
</SidePopup>

<style lang="scss">
	.pool-detail {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 1rem;
		font-family: 'Nunito Sans', sans-serif;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.75rem;

		h4 {
			margin: 0;
			font-size: 1.1rem;
			font-weight: 600;
			color: var(--dash-text-primary);
		}
	}
	.header-actions {
		margin-left: auto;
		display: flex;
		gap: 0.5rem;
	}
	.header-action {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 1.5rem;
		background: transparent;
		color: var(--dash-text-primary);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s;
	}
	.header-action:hover:not(:disabled) {
		background: rgba(111, 106, 248, 0.12);
		border-color: var(--dash-accent-purple);
	}
	.header-action:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.header-action.header-action-primary {
		border: none;
		color: #fff;
		background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 40%, #5b54e0 100%);
		box-shadow: 0 2px 8px rgba(111, 106, 248, 0.25);
	}
	.header-action.header-action-primary:hover:not(:disabled) {
		background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 40%, #5b54e0 100%);
		border-color: transparent;
		box-shadow: 0 4px 14px rgba(111, 106, 248, 0.4);
	}

	.summary {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;

		.stat {
			flex: 1;
			min-width: 120px;
			padding: 0.75rem 1rem;
			border-radius: 16px;
			background: var(--dash-card-bg);
			border: 1px solid var(--dash-card-border);
			box-shadow: var(--dash-card-shadow);

			.stat-label {
				display: block;
				font-size: var(--text-xs);
				color: var(--dash-text-muted);
				margin-bottom: 0.25rem;
			}

			.stat-value {
				display: block;
				font-weight: 600;
				color: var(--dash-text-primary);
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
		font-family: 'Nunito Sans', sans-serif;
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: transparent;
	}

	th {
		text-align: left;
		min-width: max-content;
		box-sizing: content-box;
		padding: 0.5rem min(1rem, 2%);
		color: var(--dash-text-muted);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		white-space: nowrap;
	}

	/* Match Transaction table td styling */
	:global(.pool-detail) td {
		vertical-align: middle;
		width: max-content;
		border-bottom: 1px solid var(--dash-card-border);
	}

	.amount-header {
		text-align: right;
		padding-right: 1rem;
	}

	.data-row {
		cursor: default;
		transition: background-color 0.15s;

		&:hover {
			background-color: var(--dash-surface-alt);
		}

		&.clickable-row {
			cursor: pointer;
		}
	}

	.date-cell {
		padding: 1rem min(1rem, 2%);
		min-width: 4rem;
		white-space: nowrap;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}

	.addr-cell {
		padding: 1rem min(1rem, 2%);

		.addr {
			font-family: 'Noto Sans Mono Variable', monospace;
			font-size: var(--text-sm);
			color: var(--dash-text-primary);
		}
	}

	.amount-cell {
		text-align: right;
		padding: 1rem min(1rem, 2%);
		padding-right: 1rem;
		color: var(--dash-text-primary);
	}

	.token-cell {
		padding: 1rem min(1rem, 2%);
		padding-left: 0;
		font-weight: 500;
		color: var(--dash-text-muted);
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
		background-color: var(--dash-surface-alt);
		border-radius: 12px;
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
		color: var(--dash-text-muted);
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

	.popup-subtitle {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		color: var(--dash-text-muted);
	}
	.popup-amounts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.popup-amount-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}
	.popup-label {
		color: var(--dash-text-secondary);
	}
	.popup-section {
		padding: 0.5rem;
		border-radius: 12px;
		margin-top: 0.5rem;
		h3 {
			font-size: var(--text-sm);
			font-weight: 600;
			margin: 0 0 0.4rem;
			color: var(--dash-text-secondary);
		}
		a {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: 0.875rem;
			color: var(--dash-text-primary);
		}
	}
</style>
