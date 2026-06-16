<!--
	Deposit page right column — recent-deposits rail + FAQ accordion.

	Relocated verbatim from DepositTimeline.svelte. The recent-deposits rail
	and FAQ accordion are wired to real data (GetTransactionsStore,
	extractDeposits, the hidden-Tr + SidePopup trick). Self-contained: it
	pulls `auth` via getAuth() itself.
-->
<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import SidePopup from '$lib/components/SidePopup.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	import moment from 'moment';
	import { type Snippet } from 'svelte';
	// Tr.svelte and SidePopup ARE the transactions table's modal pieces —
	// we mount Tr instances hidden, dispatch a DOM click on them when the
	// user clicks our compact "recent deposit" row, and the Tr's existing
	// onRowClick handler hands us back the exact snippet the transactions
	// page uses for its SidePopup. End result: identical modal, no
	// navigation, no duplicated content.
	import Tr from '../../../../routes/(authed)/transactions/Table/tr/Tr.svelte';
	import { getTimestamp, type TransactionInter } from '$lib/stores/txStores';
	import { Check, ChevronDown, Clock } from '@lucide/svelte';

	// ─── Recent deposits ────────────────────────────────────────────────
	type DisplayDeposit = {
		id: string;
		asset: string;
		amount: string;
		source: string;
		timeAgo: string;
		status: 'confirmed' | 'pending';
		realRef?: { tx: string; index: number };
	};

	const MOCK_RECENT_DEPOSITS: DisplayDeposit[] = [
		{
			id: 'mock-d-001',
			asset: 'HIVE',
			amount: '125.000',
			source: 'Hive Mainnet',
			timeAgo: '2 min ago',
			status: 'confirmed'
		},
		{
			id: 'mock-d-002',
			asset: 'BTC',
			amount: '0.00420000',
			source: 'Lightning',
			timeAgo: '1 h ago',
			status: 'confirmed'
		},
		{
			id: 'mock-d-003',
			asset: 'HBD',
			amount: '50.000',
			source: 'Coinbase',
			timeAgo: '6 h ago',
			status: 'pending'
		},
		{
			id: 'mock-d-004',
			asset: 'BTC',
			amount: '0.01250000',
			source: 'Bitcoin Mainnet',
			timeAgo: 'yesterday',
			status: 'confirmed'
		}
	];

	// Try to fetch the authed user's real recent deposits. The rail goes
	// through a small state machine:
	//   - 'loading': initial state AND fetch in flight.
	//   - 'unauth':  auth resolved with no did. Show mock fixtures.
	//   - 'loaded':  fetch done. Show real deposits, or an empty state.
	const authValue = $derived(getAuth()());
	let depositsState = $state<'unauth' | 'loading' | 'loaded'>('loading');
	let didFetch = $state(false);
	let realDeposits = $state<DisplayDeposit[]>([]);
	let realTxs = $state<TransactionInter[]>([]);
	let hasMoreDeposits = $state(false);
	const RECENT_DEPOSIT_LIMIT = 10;
	const RAW_TX_FETCH_LIMIT = 30;

	// ─── Transaction-detail modal state ─────────────────────────────────
	let openSnippet = $state<(() => ReturnType<Snippet>) | undefined>();
	let popupOpen = $state(false);
	function captureSnippet(_op: [string, number], content: () => ReturnType<Snippet>) {
		openSnippet = content;
		popupOpen = true;
	}
	function togglePopup() {
		popupOpen = !popupOpen;
	}

	function formatDepositTime(ts: string): string {
		const m = moment(ts);
		if (!m.isValid()) return '—';
		const hoursAgo = moment().diff(m, 'hours');
		if (hoursAgo < 24) return m.fromNow();
		const daysAgo = moment().diff(m, 'days');
		if (daysAgo < 7) return m.fromNow();
		return m.format('MMM DD, YYYY');
	}

	function formatAmount(raw: unknown, asset: string): string {
		const dp = asset.toLowerCase() === 'btc' ? 8 : 3;
		if (typeof raw === 'number') return (raw / 10 ** dp).toFixed(dp);
		if (typeof raw === 'string') {
			const n = Number(raw);
			if (Number.isFinite(n) && raw.indexOf('.') === -1) {
				return (n / 10 ** dp).toFixed(dp);
			}
			return raw;
		}
		return '—';
	}

	/** Pull out every deposit-typed entry from a single TransactionRecord. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function extractDeposits(tx: any): DisplayDeposit[] {
		if (tx?.status === 'FAILED') return [];
		const out: DisplayDeposit[] = [];
		const ts = tx ? getTimestamp(tx) : null;
		const status: 'confirmed' | 'pending' =
			tx?.status === 'CONFIRMED' || tx?.status === 'PROCESSED' || tx?.status === 'INCLUDED'
				? 'confirmed'
				: 'pending';
		const source = tx?.type === 'hive' ? 'Hive Mainnet' : 'Magi';

		// Prefer ledger entries — they have the canonical post-effect asset/amount.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ledger ?? []).forEach((entry: any, index: number) => {
			if (entry?.type !== 'deposit') return;
			const assetRaw = String(entry?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-l${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(entry?.amount, assetRaw),
				source,
				timeAgo: ts ? formatDepositTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});

		if (out.length > 0) return out;

		// Fall back to ops[].type === 'deposit' (used for Hive L1 deposits).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ops ?? []).forEach((op: any, index: number) => {
			if (op?.type !== 'deposit') return;
			const assetRaw = String(op?.data?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-o${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(op?.data?.amount, assetRaw),
				source,
				timeAgo: ts ? formatDepositTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});

		return out;
	}

	$effect(() => {
		if (didFetch) return; // one-shot: don't re-fire on auth churn

		if (authValue.status === 'pending') return;

		didFetch = true;
		const did = authValue.value?.did;

		if (!did) {
			depositsState = 'unauth';
			return;
		}

		new GetTransactionsStore()
			.fetch({
				variables: { did, limit: RAW_TX_FETCH_LIMIT, offset: 0 },
				policy: 'NetworkOnly'
			})
			.then((result) => {
				const rawTxs = (result.data?.findTransaction ?? []) as TransactionInter[];
				const allDeposits = rawTxs.flatMap((tx) => extractDeposits(tx));

				hasMoreDeposits =
					allDeposits.length > RECENT_DEPOSIT_LIMIT || rawTxs.length >= RAW_TX_FETCH_LIMIT;
				realTxs = rawTxs.map((tx) => ({ ...tx, isPending: false }));
				realDeposits = allDeposits.slice(0, RECENT_DEPOSIT_LIMIT);
				depositsState = 'loaded';
			})
			.catch(() => {
				realDeposits = [];
				depositsState = 'loaded';
			});
	});

	const displayDeposits = $derived<DisplayDeposit[]>(
		depositsState === 'unauth' ? MOCK_RECENT_DEPOSITS : realDeposits
	);

	let activeMockDeposit = $state<DisplayDeposit | null>(null);

	function handleDepositClick(d: DisplayDeposit) {
		if (d.realRef) {
			const root = document.querySelector(
				`[data-mock-tr-deposit-id="${CSS.escape(d.id)}"] tr.clickable-row`
			) as HTMLElement | null;
			root?.click();
		} else {
			activeMockDeposit = d;
			openSnippet = mockDepositSnippet;
			popupOpen = true;
		}
	}

	// ─── FAQ accordion ──────────────────────────────────────────────────
	let openFaqIdx = $state<number | null>(null);
	function toggleFaq(idx: number) {
		openFaqIdx = openFaqIdx === idx ? null : idx;
	}
</script>

<aside class="rail">
	<section>
		<h5>Recent deposits</h5>
		<!--
			Three rendered states:
			  - loading: WaveLoading (consistent with LineChart's loading)
			  - loaded + empty: small "no recent deposits" empty state
			  - has items: the list (real for authed users with data,
			    or mock fixtures for unauthenticated previews)
		-->
		{#if depositsState === 'loading'}
			<div class="recent-loading">
				<WaveLoading size={18} />
			</div>
		{:else if displayDeposits.length === 0}
			<p class="rail-empty">No recent deposits yet.</p>
		{:else}
			<ul class="recent-list">
				{#each displayDeposits as d (d.id)}
					<li>
						<button class="recent-item" type="button" onclick={() => handleDepositClick(d)}>
							<div class="recent-icon" data-status={d.status}>
								{#if d.status === 'confirmed'}
									<Check size={12} strokeWidth={3} />
								{:else}
									<Clock size={12} />
								{/if}
							</div>
							<div class="recent-body">
								<div class="recent-top">
									<span class="recent-amount">+{d.amount} {d.asset}</span>
									<span class="recent-time">{d.timeAgo}</span>
								</div>
								<div class="recent-bottom">
									<span class="recent-source">from {d.source}</span>
									{#if d.status === 'pending'}
										<span class="recent-status pending">pending</span>
									{/if}
								</div>
							</div>
						</button>
					</li>
				{/each}
			</ul>
			{#if hasMoreDeposits}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
				<a class="recent-view-more" href="/transactions"> View all deposits → </a>
			{/if}
		{/if}
	</section>

	<section>
		<h5>FAQ</h5>
		<!--
			Plain custom accordion. Each FAQ is a Card with a trigger
			button and conditionally-rendered content.
		-->
		<Card>
			<button
				class="faq-trigger"
				class:open={openFaqIdx === 0}
				type="button"
				onclick={() => toggleFaq(0)}
				aria-expanded={openFaqIdx === 0}
			>
				<span>How long does a deposit take?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 0}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>Depends on the source you pick:</p>
					<ul>
						<li><strong>Hive Mainnet</strong> — instant once your block confirms</li>
						<li><strong>Lightning</strong> — about a minute</li>
						<li><strong>Bitcoin Mainnet</strong> — about 10 minutes (1 confirmation)</li>
						<li><strong>Coinbase</strong> — around 15 minutes after the card charge</li>
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
						<li><strong>Hive Mainnet</strong> — free</li>
						<li><strong>Lightning</strong> — small gateway fee (~10 sats)</li>
						<li><strong>Bitcoin Mainnet</strong> — pays the on-chain network fee</li>
						<li><strong>Coinbase</strong> — Coinbase&rsquo;s card-processing fee applies</li>
					</ul>
					<p>
						If your route says <em>via swap</em>, an extra AMM fee from the on-chain pool applies on
						top.
					</p>
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
				<span>Deposit hasn&rsquo;t arrived?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 2}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>
						Most deposits show as <em>pending</em> in the
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
						<a href="/transactions">Transactions</a> page before confirming. If you don&rsquo;t see one:
					</p>
					<ol>
						<li>For Bitcoin Mainnet, allow at least 1 on-chain confirmation (~10 min).</li>
						<li>For Lightning, check that the invoice was actually paid (not just generated).</li>
						<li>Refresh the Transactions page — there&rsquo;s no live polling yet.</li>
						<li>Still missing? Share the source tx id with support.</li>
					</ol>
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
				<span>What does &ldquo;via swap&rdquo; mean?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 3}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>
						The source you picked delivers a different asset than the one you want to receive. Magi
						accepts what the source sends, then runs an on-chain swap into your chosen asset before
						crediting your balance.
					</p>
					<p>
						For example, &ldquo;Receive HIVE&rdquo; + &ldquo;From Coinbase&rdquo; charges your card
						as USD, deposits BTC, then swaps BTC&nbsp;→&nbsp;HIVE on the Magi DEX. The whole thing
						happens in one flow.
					</p>
				</div>
			{/if}
		</Card>
	</section>
</aside>

<!--
	Hidden Tr instances — one per REAL deposit row in the rail. They render
	the transactions-table row markup but stay visually hidden. When the
	user clicks our compact recent-deposit button we DOM-dispatch a click
	on the corresponding `tr.clickable-row` here, which fires Tr's own
	`handleTrigger` → `onRowClick(op, thisRowContent)`. Our `captureSnippet`
	callback then plugs `thisRowContent` into the SidePopup below.
-->
<div class="hidden-tr-mount" aria-hidden="true">
	{#each realDeposits ?? [] as d (d.id)}
		{#if d.realRef}
			{@const tx = realTxs.find((t) => t.id === d.realRef!.tx)}
			{@const op = tx?.ops?.[d.realRef.index]}
			{#if tx && op}
				<table data-mock-tr-deposit-id={d.id}>
					<tbody>
						<Tr {tx} {op} onRowClick={captureSnippet} />
					</tbody>
				</table>
			{/if}
		{/if}
	{/each}
</div>

<!--
	Mock-deposit snippet — used when the clicked recent deposit doesn't
	have a real on-chain tx (the fallback fixtures).
-->
{#snippet mockDepositSnippet()}
	{#if activeMockDeposit}
		<h3 class="mock-modal-title">Deposit · {activeMockDeposit.asset}</h3>
		<p class="mock-modal-amount">+{activeMockDeposit.amount} {activeMockDeposit.asset}</p>
		<dl class="mock-modal-fields">
			<div>
				<dt>From</dt>
				<dd>{activeMockDeposit.source}</dd>
			</div>
			<div>
				<dt>When</dt>
				<dd>{activeMockDeposit.timeAgo}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd class="mock-modal-status" data-status={activeMockDeposit.status}>
					{activeMockDeposit.status}
				</dd>
			</div>
		</dl>
		<p class="mock-modal-hint">
			This is mock data. Sign in with a Hive account that has real deposits to see live transaction
			details here.
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

	/* ─── Right rail ─────────────────────────────────────────────────────── */
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

	/* ── Custom FAQ accordion. */
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
		border-radius: 27px; /* match Card so hover/focus ring stays rounded */
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
		font-weight: 400;
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
		font-weight: 400;
	}
	:global(.faq-body li::marker) {
		color: var(--dash-text-muted);
	}
	:global(.faq-body strong) {
		color: var(--dash-text-primary);
		font-weight: 600;
	}
	:global(.faq-body em) {
		font-style: italic;
		color: var(--dash-text-primary);
	}
	:global(.faq-body a) {
		color: $accent;
		text-decoration: none;
		border-bottom: 1px solid rgba(111, 106, 248, 0.35);
	}
	:global(.faq-body a:hover) {
		border-bottom-color: $accent;
	}

	/* ── Recent deposits ──────────────────────────────────────────────── */
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
		font-weight: 400;
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

	/* Hidden <Tr> instances. */
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

	/* Mock-deposit modal content. */
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
