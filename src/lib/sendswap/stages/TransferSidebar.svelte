<!--
	Transfer page right column — recent-transfers rail + FAQ accordion.

	Sibling of DepositSidebar / WithdrawSidebar, and deliberately the same
	shape, so /transfer reads as one of the same family of wallet task pages.

	One difference: where those two re-open a transaction's detail modal via a
	hidden <Tr> plus SidePopup, a recent transfer here is a plain link to
	`/transactions?tx=…&index=…`. That deep link already exists — it is what
	the notification feed uses — so this gets the same destination without a
	second copy of the modal machinery.
-->
<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import moment from 'moment';
	import { getTimestamp } from '$lib/stores/txStores';
	import { useRecentTxs } from './recentTxs.svelte';
	import { ArrowDownLeft, ArrowUpRight, ChevronDown } from '@lucide/svelte';

	type DisplayTransfer = {
		id: string;
		asset: string;
		amount: string;
		/** The other party — who it went to, or who it came from. */
		counterparty: string;
		direction: 'out' | 'in';
		timeAgo: string;
		status: 'confirmed' | 'pending';
		href?: string;
	};

	const authValue = $derived(getAuth()());
	const recent = useRecentTxs();
	const RECENT_LIMIT = 8;

	function formatTime(ts: string): string {
		const m = moment(ts);
		if (!m.isValid()) return '—';
		if (moment().diff(m, 'days') < 7) return m.fromNow();
		return m.format('MMM DD, YYYY');
	}

	function formatAmount(raw: unknown, asset: string): string {
		const dp = asset.toLowerCase() === 'btc' ? 8 : 3;
		const n = typeof raw === 'number' ? raw : Number(raw);
		if (!Number.isFinite(n)) return typeof raw === 'string' ? raw : '—';
		// Ledger amounts are signed by direction; the arrow carries that here.
		return (Math.abs(n) / 10 ** dp).toFixed(dp);
	}

	/**
	 * The app's canonical type match (see `transactions/filters.ts`): an exact
	 * `transfer`, or a `transfer_*` variant. NOT a substring test — that also
	 * catches the `transfer.allow` intents attached to contract calls.
	 */
	function isTransferType(t: unknown): boolean {
		const v = String(t ?? '').toLowerCase();
		return v === 'transfer' || v.startsWith('transfer_');
	}

	/** `hive:alice` / `did:pkh:…:0xabc…` → something that fits the rail. */
	function shortParty(value: unknown): string {
		const raw = String(value ?? '').trim();
		if (!raw) return 'someone';
		const tail = raw.split(':').at(-1) ?? raw;
		return tail.length > 16 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail;
	}

	/**
	 * Transfers the USER made, which is not the same thing as transfer-typed
	 * ledger rows.
	 *
	 * Every swap and contract call settles as `transfer` ledger entries — this
	 * account has 172 of those against 19 actual transfer ops — so reading the
	 * ledger first fills the rail with the internal legs of swaps. So: take the
	 * signed `transfer` OPERATION where there is one, and only fall back to the
	 * ledger for a transaction that has no ops at all, and then only for rows
	 * with a real party at BOTH ends (a swap leg has an empty `from`).
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function extractTransfers(tx: any, me: string | undefined): DisplayTransfer[] {
		if (tx?.status === 'FAILED') return [];
		const out: DisplayTransfer[] = [];
		const ts = tx ? getTimestamp(tx) : null;
		const status: 'confirmed' | 'pending' =
			tx?.status === 'CONFIRMED' || tx?.status === 'PROCESSED' || tx?.status === 'INCLUDED'
				? 'confirmed'
				: 'pending';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const push = (data: any, index: number, kind: 'l' | 'o') => {
			const assetRaw = String(data?.asset ?? '').split('_')[0] || 'hive';
			const to = data?.to;
			const from = data?.from;
			const mine = (v: unknown) => !!me && String(v ?? '').endsWith(me);
			const direction: 'out' | 'in' = mine(to) && !mine(from) ? 'in' : 'out';
			out.push({
				id: `${tx.id}-${kind}${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(data?.amount, assetRaw),
				counterparty: shortParty(direction === 'in' ? from : to),
				direction,
				timeAgo: ts ? formatTime(ts) : '—',
				status,
				href: `/transactions?tx=${encodeURIComponent(tx.id)}&index=${index}`
			});
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ops: any[] = tx?.ops ?? [];
		ops.forEach((op, index) => {
			if (isTransferType(op?.type)) push(op?.data ?? {}, index, 'o');
		});
		if (out.length > 0 || ops.length > 0) return out;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ledger ?? []).forEach((entry: any, index: number) => {
			if (!isTransferType(entry?.type)) return;
			if (!String(entry?.from ?? '').trim() || !String(entry?.to ?? '').trim()) return;
			push(entry, index, 'l');
		});
		return out;
	}

	const me = $derived(getUsernameFromAuth(authValue));
	const allTransfers = $derived(recent.txs.flatMap((tx) => extractTransfers(tx, me)));
	const transfers = $derived(allTransfers.slice(0, RECENT_LIMIT));
	const hasMore = $derived(allTransfers.length > RECENT_LIMIT);

	let openFaqIdx = $state<number | null>(null);
	function toggleFaq(idx: number) {
		openFaqIdx = openFaqIdx === idx ? null : idx;
	}
</script>

<aside class="rail">
	<section>
		<h5>Recent transfers</h5>
		{#if recent.unauth}
			<p class="rail-empty">Connect a wallet to see your recent transfers.</p>
		{:else if transfers.length > 0}
			<ul class="recent-list">
				<!-- Position is part of the key on purpose. The ids are derived
				     from tx id + entry index, and a single bad duplicate throws
				     `each_key_duplicate`, which breaks the component for the rest
				     of the session — not worth risking for list-diffing on a
				     rail that only ever replaces itself wholesale. -->
				{#each transfers as t, i (`${t.id}#${i}`)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
						<a class="recent-item" href={t.href}>
							<div class="recent-icon" data-status={t.status}>
								{#if t.direction === 'in'}<ArrowDownLeft size={12} strokeWidth={2.5} />{:else}
									<ArrowUpRight size={12} strokeWidth={2.5} />{/if}
							</div>
							<div class="recent-body">
								<div class="recent-top">
									<span class="recent-amount"
										>{t.direction === 'in' ? '+' : '−'}{t.amount} {t.asset}</span
									>
									<span class="recent-time">{t.timeAgo}</span>
								</div>
								<div class="recent-bottom">
									<span class="recent-source"
										>{t.direction === 'in' ? 'from' : 'to'} {t.counterparty}</span
									>
									{#if t.status === 'pending'}<span class="recent-status pending">pending</span
										>{/if}
								</div>
							</div>
						</a>
					</li>
				{/each}
			</ul>
			{#if hasMore}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal link; resolve() not exported in this kit version -->
				<a class="recent-view-more" href="/transactions">View all transactions →</a>
			{/if}
		{:else if recent.loading}
			<div class="recent-loading"><WaveLoading size={18} /></div>
		{:else}
			<p class="rail-empty">No transfers yet. Your next one will show up here.</p>
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
				<span>How long does a transfer take?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 0}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>
						A transfer between two Magi accounts settles in the next block — a few seconds. It shows
						as <strong>pending</strong> until that block confirms.
					</p>
					<p>
						Sending out to Hive mainnet or Bitcoin takes as long as that chain does. Pick the route
						in step 3.
					</p>
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
						<li><strong>Magi → Magi</strong> — free, and it costs no resource credits</li>
						<li><strong>Hive mainnet</strong> — free</li>
						<li>
							<strong>Bitcoin mainnet</strong> — pays the on-chain network fee, which you can cap
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
						Step 1 lists only what you hold on Magi, so an asset with a zero balance is not offered.
					</p>
					<p>
						To send from a Hive Mainnet balance instead, use
						<strong>Use another asset or network</strong> under the chips.
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
				<span>Can I get a transfer back?</span>
				<ChevronDown class="faq-chevron" size={16} />
			</button>
			{#if openFaqIdx === 3}
				<div class="faq-divider"><hr /></div>
				<div class="faq-body">
					<p>
						No. A confirmed transfer is final and there is no one who can reverse it — check the
						recipient on the review screen before you sign.
					</p>
					<p>
						Save the people you pay often as contacts so you are picking a name, not typing one.
					</p>
				</div>
			{/if}
		</Card>
	</section>
</aside>

<style lang="scss">
	$accent: #6f6af8;
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

	/* The FAQ accordion lives inside <Card>, so these have to be :global —
	   same arrangement as the deposit and withdraw rails. */
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
	:global(.faq-chevron) {
		flex-shrink: 0;
		transition: transform 200ms ease;
		color: var(--dash-text-secondary);
	}
	:global(.faq-trigger.open .faq-chevron) {
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
	:global(.faq-body ul) {
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
		text-decoration: none;
		cursor: pointer;
		width: 100%;
		box-sizing: border-box;
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
	/* Direction, not status, drives the colour here: on a transfer rail what
	   matters at a glance is whether money left or arrived. */
	.recent-icon {
		background: rgba(255, 255, 255, 0.07);
		color: var(--dash-text-secondary);
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
	}
	.recent-view-more:hover {
		text-decoration: underline;
	}
</style>
