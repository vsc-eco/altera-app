<!--
	Withdraw page right column — recent-withdrawals rail + FAQ accordion.

	Asset-first sibling of DepositSidebar.svelte: same structure and the same
	hidden-Tr + SidePopup trick for opening a real transaction's detail modal,
	but filters for withdrawal-typed ledger/ops instead of deposits. Self
	contained: pulls `auth` via getAuth() itself.
-->
<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import SidePopup from '$lib/components/SidePopup.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	import moment from 'moment';
	import { type Snippet } from 'svelte';
	import Tr from '../../../../routes/(authed)/transactions/Table/tr/Tr.svelte';
	import { getTimestamp, type TransactionInter } from '$lib/stores/txStores';
	import { Check, ChevronDown, Clock } from '@lucide/svelte';

	// ─── Recent withdrawals ─────────────────────────────────────────────────
	type DisplayWithdrawal = {
		id: string;
		asset: string;
		amount: string;
		destination: string;
		timeAgo: string;
		status: 'confirmed' | 'pending';
		realRef?: { tx: string; index: number };
	};

	const MOCK_RECENT_WITHDRAWALS: DisplayWithdrawal[] = [
		{
			id: 'mock-w-001',
			asset: 'BTC',
			amount: '0.00400000',
			destination: 'Bitcoin mainnet',
			timeAgo: '2 h ago',
			status: 'confirmed'
		},
		{
			id: 'mock-w-002',
			asset: 'HIVE',
			amount: '300.000',
			destination: 'Hive mainnet',
			timeAgo: 'yesterday',
			status: 'confirmed'
		},
		{
			id: 'mock-w-003',
			asset: 'BTC',
			amount: '0.00015000',
			destination: 'Lightning',
			timeAgo: '3 d ago',
			status: 'pending'
		}
	];

	const authValue = $derived(getAuth()());
	let loadState = $state<'unauth' | 'loading' | 'loaded'>('loading');
	let didFetch = $state(false);
	let realWithdrawals = $state<DisplayWithdrawal[]>([]);
	let realTxs = $state<TransactionInter[]>([]);
	let hasMore = $state(false);
	const RECENT_LIMIT = 10;
	const RAW_TX_FETCH_LIMIT = 30;

	let openSnippet = $state<(() => ReturnType<Snippet>) | undefined>();
	let popupOpen = $state(false);
	function captureSnippet(_op: [string, number], content: () => ReturnType<Snippet>) {
		openSnippet = content;
		popupOpen = true;
	}
	function togglePopup() {
		popupOpen = !popupOpen;
	}

	function formatTime(ts: string): string {
		const m = moment(ts);
		if (!m.isValid()) return '—';
		if (moment().diff(m, 'days') < 7) return m.fromNow();
		return m.format('MMM DD, YYYY');
	}
	function formatAmount(raw: unknown, asset: string): string {
		const dp = asset.toLowerCase() === 'btc' ? 8 : 3;
		if (typeof raw === 'number') return (raw / 10 ** dp).toFixed(dp);
		if (typeof raw === 'string') {
			const n = Number(raw);
			if (Number.isFinite(n) && raw.indexOf('.') === -1) return (n / 10 ** dp).toFixed(dp);
			return raw;
		}
		return '—';
	}
	function isWithdrawType(t: unknown): boolean {
		return String(t ?? '')
			.toLowerCase()
			.includes('withdraw');
	}
	function destinationFor(asset: string): string {
		const a = asset.toLowerCase();
		if (a === 'hive' || a === 'hbd') return 'Hive mainnet';
		if (a === 'btc' || a === 'sats') return 'Bitcoin / Lightning';
		return 'Withdrawal';
	}

	/** Pull every withdrawal-typed entry out of a single TransactionRecord. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function extractWithdrawals(tx: any): DisplayWithdrawal[] {
		if (tx?.status === 'FAILED') return [];
		const out: DisplayWithdrawal[] = [];
		const ts = tx ? getTimestamp(tx) : null;
		const status: 'confirmed' | 'pending' =
			tx?.status === 'CONFIRMED' || tx?.status === 'PROCESSED' || tx?.status === 'INCLUDED'
				? 'confirmed'
				: 'pending';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ledger ?? []).forEach((entry: any, index: number) => {
			if (!isWithdrawType(entry?.type)) return;
			const assetRaw = String(entry?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-l${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(entry?.amount, assetRaw),
				destination: destinationFor(assetRaw),
				timeAgo: ts ? formatTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});
		if (out.length > 0) return out;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ops ?? []).forEach((op: any, index: number) => {
			if (!isWithdrawType(op?.type)) return;
			const assetRaw = String(op?.data?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-o${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(op?.data?.amount, assetRaw),
				destination: destinationFor(assetRaw),
				timeAgo: ts ? formatTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});
		return out;
	}

	$effect(() => {
		if (didFetch) return;
		if (authValue.status === 'pending') return;
		didFetch = true;
		const did = authValue.value?.did;
		if (!did) {
			loadState = 'unauth';
			return;
		}
		new GetTransactionsStore()
			.fetch({ variables: { did, limit: RAW_TX_FETCH_LIMIT, offset: 0 }, policy: 'NetworkOnly' })
			.then((result) => {
				const rawTxs = (result.data?.findTransaction ?? []) as TransactionInter[];
				const all = rawTxs.flatMap((tx) => extractWithdrawals(tx));
				hasMore = all.length > RECENT_LIMIT || rawTxs.length >= RAW_TX_FETCH_LIMIT;
				realTxs = rawTxs.map((tx) => ({ ...tx, isPending: false }));
				realWithdrawals = all.slice(0, RECENT_LIMIT);
				loadState = 'loaded';
			})
			.catch(() => {
				realWithdrawals = [];
				loadState = 'loaded';
			});
	});

	const displayWithdrawals = $derived<DisplayWithdrawal[]>(
		loadState === 'unauth' ? MOCK_RECENT_WITHDRAWALS : realWithdrawals
	);

	let activeMock = $state<DisplayWithdrawal | null>(null);
	function handleClick(d: DisplayWithdrawal) {
		if (d.realRef) {
			const root = document.querySelector(
				`[data-mock-tr-withdraw-id="${CSS.escape(d.id)}"] tr.clickable-row`
			) as HTMLElement | null;
			root?.click();
		} else {
			activeMock = d;
			openSnippet = mockSnippet;
			popupOpen = true;
		}
	}

	let openFaqIdx = $state<number | null>(null);
	function toggleFaq(idx: number) {
		openFaqIdx = openFaqIdx === idx ? null : idx;
	}
</script>

<aside class="rail">
	<section>
		<h5>Recent withdrawals</h5>
		{#if loadState === 'loading'}
			<div class="recent-loading"><WaveLoading size={18} /></div>
		{:else if displayWithdrawals.length === 0}
			<p class="rail-empty">No recent withdrawals yet.</p>
		{:else}
			<ul class="recent-list">
				{#each displayWithdrawals as d (d.id)}
					<li>
						<button class="recent-item" type="button" onclick={() => handleClick(d)}>
							<div class="recent-icon" data-status={d.status}>
								{#if d.status === 'confirmed'}<Check size={12} strokeWidth={3} />{:else}<Clock
										size={12}
									/>{/if}
							</div>
							<div class="recent-body">
								<div class="recent-top">
									<span class="recent-amount">−{d.amount} {d.asset}</span>
									<span class="recent-time">{d.timeAgo}</span>
								</div>
								<div class="recent-bottom">
									<span class="recent-source">to {d.destination}</span>
									{#if d.status === 'pending'}<span class="recent-status pending">pending</span
										>{/if}
								</div>
							</div>
						</button>
					</li>
				{/each}
			</ul>
			{#if hasMore}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
				<a class="recent-view-more" href="/transactions"> View all withdrawals → </a>
			{/if}
		{/if}
	</section>

	<section>
		<h5>FAQ</h5>
		<Card>
			<button
				class="faq-trigger"
				class:open={openFaqIdx === 0}
				type="button"
				onclick={() => toggleFaq(0)}
				aria-expanded={openFaqIdx === 0}
			>
				<span>How long does a withdrawal take?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 0}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>Depends on the destination you pick:</p>
					<ul>
						<li><strong>Hive mainnet</strong> — instant once the block confirms</li>
						<li><strong>Lightning</strong> — about a minute</li>
						<li><strong>Bitcoin mainnet</strong> — about 10 minutes (1 confirmation)</li>
					</ul>
					<p>Each option shows its ETA in step 2.</p>
				</div>
			{/if}
		</Card>
		<Card>
			<button
				class="faq-trigger"
				class:open={openFaqIdx === 1}
				type="button"
				onclick={() => toggleFaq(1)}
				aria-expanded={openFaqIdx === 1}
			>
				<span>Are there fees?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 1}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<ul>
						<li><strong>Hive mainnet</strong> — free</li>
						<li><strong>Lightning</strong> — small gateway fee (~10 sats)</li>
						<li>
							<strong>Bitcoin mainnet</strong> — pays the on-chain network fee (you can cap it)
						</li>
					</ul>
				</div>
			{/if}
		</Card>
		<Card>
			<button
				class="faq-trigger"
				class:open={openFaqIdx === 2}
				type="button"
				onclick={() => toggleFaq(2)}
				aria-expanded={openFaqIdx === 2}
			>
				<span>Why can&rsquo;t I see an asset?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 2}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>
						Step 1 only lists assets you currently hold on Magi — you can&rsquo;t withdraw a balance
						you don&rsquo;t have. Deposit or swap into an asset first and it&rsquo;ll appear here.
					</p>
				</div>
			{/if}
		</Card>
		<Card>
			<button
				class="faq-trigger"
				class:open={openFaqIdx === 3}
				type="button"
				onclick={() => toggleFaq(3)}
				aria-expanded={openFaqIdx === 3}
			>
				<span>Withdrawal hasn&rsquo;t arrived?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 3}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<ol>
						<li>For Bitcoin mainnet, allow at least 1 on-chain confirmation (~10 min).</li>
						<li>Double-check the destination address/account was correct.</li>
						<li>
							Refresh the
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
							<a href="/transactions">Transactions</a> page — there&rsquo;s no live polling yet.
						</li>
						<li>Still missing? Share the tx id with support.</li>
					</ol>
				</div>
			{/if}
		</Card>
	</section>
</aside>

<div class="hidden-tr-mount" aria-hidden="true">
	{#each realWithdrawals ?? [] as d (d.id)}
		{#if d.realRef}
			{@const tx = realTxs.find((t) => t.id === d.realRef!.tx)}
			{@const op = tx?.ops?.[d.realRef.index]}
			{#if tx && op}
				<table data-mock-tr-withdraw-id={d.id}>
					<tbody>
						<Tr {tx} {op} onRowClick={captureSnippet} />
					</tbody>
				</table>
			{/if}
		{/if}
	{/each}
</div>

{#snippet mockSnippet()}
	{#if activeMock}
		<h3 class="mock-modal-title">Withdrawal · {activeMock.asset}</h3>
		<p class="mock-modal-amount">−{activeMock.amount} {activeMock.asset}</p>
		<dl class="mock-modal-fields">
			<div>
				<dt>To</dt>
				<dd>{activeMock.destination}</dd>
			</div>
			<div>
				<dt>When</dt>
				<dd>{activeMock.timeAgo}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd class="mock-modal-status" data-status={activeMock.status}>{activeMock.status}</dd>
			</div>
		</dl>
		<p class="mock-modal-hint">
			This is mock data. Sign in with a Hive account that has real withdrawals to see live
			transaction details here.
		</p>
	{/if}
{/snippet}

<SidePopup content={openSnippet} bind:open={popupOpen} toggle={togglePopup} />

<style lang="scss">
	$accent: #6f6af8;
	$accent-soft: rgba(111, 106, 248, 0.16);
	$border: rgba(255, 255, 255, 0.09);
	$border-strong: rgba(255, 255, 255, 0.16);
	$surface: rgba(255, 255, 255, 0.035);
	$surface-strong: rgba(255, 255, 255, 0.06);

	.rail {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}
	.rail h5 {
		margin: 0 0 0.6rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--dash-text-secondary);
	}
	.rail section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.rail-empty {
		margin: 0;
		color: var(--dash-text-muted);
		font-size: 0.85rem;
	}

	:global(.faq-trigger) {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: -1.25rem;
		padding: 1.25rem;
		background: transparent;
		border: none;
		color: var(--dash-text-primary);
		font: inherit;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		border-radius: 27px;
	}
	:global(.faq-trigger.open) {
		margin-bottom: 0;
	}
	:global(.faq-trigger) :global(.faq-chevron) {
		flex-shrink: 0;
		transition: transform 200ms ease;
		color: var(--dash-text-secondary);
	}
	:global(.faq-trigger[aria-expanded='true']) :global(.faq-chevron) {
		transform: rotate(180deg);
	}
	:global(.faq-divider) {
		padding: 0.5rem 0;
	}
	:global(.faq-divider hr) {
		margin: 0;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	:global(.faq-body) {
		font-size: 0.83rem;
		line-height: 1.5;
		color: var(--dash-text-secondary);
		font-weight: 400;
	}
	:global(.faq-body p) {
		margin: 0 0 0.5rem;
	}
	:global(.faq-body p:last-child) {
		margin-bottom: 0;
	}
	:global(.faq-body ul),
	:global(.faq-body ol) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
	}
	:global(.faq-body li) {
		margin: 0.25rem 0;
	}
	:global(.faq-body li::marker) {
		color: var(--dash-text-muted);
	}
	:global(.faq-body strong) {
		color: var(--dash-text-primary);
		font-weight: 600;
	}
	:global(.faq-body a) {
		color: $accent;
		text-decoration: none;
		border-bottom: 1px solid rgba(111, 106, 248, 0.35);
	}

	.recent-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.recent-item {
		display: grid;
		grid-template-columns: 1.6rem 1fr;
		gap: 0.6rem;
		align-items: center;
		padding: 0.55rem 0.65rem;
		background: $surface;
		border: 1px solid $border;
		border-radius: 10px;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		width: 100%;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.recent-item:hover,
	.recent-item:focus-visible {
		background: $surface-strong;
		border-color: $border-strong;
		outline: none;
	}
	.recent-icon {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.recent-icon[data-status='confirmed'] {
		background: rgba(74, 222, 128, 0.18);
		color: #6ee7a1;
	}
	.recent-icon[data-status='pending'] {
		background: rgba(255, 200, 0, 0.15);
		color: #f5c451;
	}
	.recent-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.recent-top {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: baseline;
	}
	.recent-amount {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--dash-text-primary);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.recent-time {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.recent-bottom {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		font-size: 0.72rem;
		color: var(--dash-text-secondary);
	}
	.recent-source {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-status.pending {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.6rem;
		font-weight: 700;
		color: #f5c451;
		flex-shrink: 0;
	}
	.recent-loading {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1rem 0;
		color: var(--dash-text-secondary);
	}
	.recent-view-more {
		display: inline-flex;
		margin-top: 0.5rem;
		padding: 0.45rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: $accent;
		text-decoration: none;
		border-radius: 8px;
		transition: background-color 150ms ease;
	}
	.recent-view-more:hover {
		background: $accent-soft;
	}

	.hidden-tr-mount {
		position: absolute;
		left: -9999px;
		top: 0;
		width: 0;
		height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	.mock-modal-title {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	.mock-modal-amount {
		margin: 0 0 1rem;
		font-size: 1.6rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--dash-text-primary);
	}
	.mock-modal-fields {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 0.5rem 1rem;
		margin: 0 0 1rem;
		font-size: 0.88rem;
	}
	.mock-modal-fields > div {
		display: contents;
	}
	.mock-modal-fields dt {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dash-text-secondary);
		font-weight: 600;
		padding-top: 0.15rem;
	}
	.mock-modal-fields dd {
		margin: 0;
		color: var(--dash-text-primary);
	}
	.mock-modal-status {
		text-transform: capitalize;
		font-weight: 500;
	}
	.mock-modal-status[data-status='confirmed'] {
		color: #6ee7a1;
	}
	.mock-modal-status[data-status='pending'] {
		color: #f5c451;
	}
	.mock-modal-hint {
		font-size: 0.78rem;
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
		padding: 0.6rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px dashed rgba(255, 255, 255, 0.1);
		border-radius: 8px;
	}
</style>
