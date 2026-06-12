<!--
	Contract Updates panel — surfaces pending governance updates on the
	witness page so witnesses can audit code that's about to ship.

	Aligned with the `findPendingContractUpdates` GraphQL shape from
	go-vsc-node PR #210. While that PR is unmerged we read from
	`mockData.ts`; swap to the Houdini store once the field is live.

	The chain has no concept of contract name / category / human title —
	those come from a curated client-side registry (`CONTRACT_REGISTRY`
	in mockData.ts). Updates against unknown contracts still render
	(showing a truncated id) but with no friendly label.
-->
<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import Countdown from './Countdown.svelte';
	import { loadPendingUpdates, type LoadResult } from './loader';
	import { tsToUnixSec, type ContractUpdateView } from './types';
	import { proposerTxUrl, codeIpfsUrl, contractExplorerUrl } from './auditLinks';
	import { ExternalLink, FileCode2, Loader2, ShieldAlert, User } from '@lucide/svelte';

	type SectionState = { source: 'loading' } | LoadResult;
	let state = $state<SectionState>({ source: 'loading' });

	$effect(() => {
		// Initial fetch + a light 10s poll. The poll matters for live
		// observation: on testnet the contract-update timelock is ~90
		// seconds, so a queued update must appear without a manual refresh
		// or the window is missed. Sequential guard: skip a tick if the
		// previous request is still in flight.
		let inFlight = false;
		const refresh = () => {
			if (inFlight) return;
			inFlight = true;
			loadPendingUpdates()
				.then((r) => {
					// Live-test diagnostics: timestamp every pending-count change
					// so the UI's detection moment can be compared against the
					// deploy moment. Strip with the loader logs post-verification.
					const prevCount = state.source === 'loading' ? -1 : state.updates.length;
					if (r.updates.length !== prevCount) {
						console.debug(
							`[contract-updates] ${new Date().toISOString()} pending: ${prevCount === -1 ? '(initial)' : prevCount} → ${r.updates.length} (source: ${r.source})`
						);
					}
					state = r;
				})
				.finally(() => {
					inFlight = false;
				});
		};
		refresh();
		const handle = setInterval(refresh, 30_000);
		return () => clearInterval(handle);
	});

	const pending = $derived<ContractUpdateView[]>(state.source === 'loading' ? [] : state.updates);
	const isMock = $derived(state.source === 'mock');
	const mockReason = $derived(state.source === 'mock' ? state.reason : '');

	function shortId(id: string): string {
		return `${id.slice(0, 8)}…${id.slice(-4)}`;
	}

	function categoryFor(u: ContractUpdateView): string {
		return u.metadata?.category ?? 'other';
	}

	function titleFor(u: ContractUpdateView): string {
		// Precedence: curated registry name → on-chain contract name
		// (findContract.name, e.g. "DEX Router") → short id.
		const name = u.metadata?.name ?? u.chainName;
		return name ? `Upgrade · ${name}` : `Upgrade · contract ${shortId(u.id)}`;
	}
</script>

<Card>
	<header class="head">
		<div>
			<h3>
				<ShieldAlert size={18} />
				Contract updates
			</h3>
			<p class="lead">
				System-contract code changes (pools, bridge, gateway, …) are time-locked. Audit the new code
				before it activates.
			</p>
		</div>
		{#if isMock}
			<div
				class="mock-badge"
				title={`Backend not yet returning data (${mockReason}). Showing mock fixtures until go-vsc-node PR #210 is live on api.vsc.eco.`}
			>
				MOCK DATA · PR #210
			</div>
		{/if}
	</header>

	<section>
		<h4 class="section-heading">
			<span>Pending</span>
			{#if pending.length > 0}
				<span class="count pending">{pending.length}</span>
			{:else}
				<span class="count">0</span>
			{/if}
		</h4>

		{#if state.source === 'loading'}
			<p class="empty loading">
				<Loader2 size={14} class="spin" />
				Loading pending updates…
			</p>
		{:else if pending.length === 0}
			<p class="empty">No pending contract updates.</p>
		{:else}
			<ul class="list">
				{#each pending as u (u.id)}
					<li class="row pending-row">
						<a class="row-main" href={`/witness-assistant/contract-update/${u.id}`}>
							<div class="row-head">
								<span class="kind kind-{categoryFor(u)}">
									{u.metadata?.category ?? 'contract'}
								</span>
								<strong class="title">{titleFor(u)}</strong>
							</div>
							<div class="row-meta">
								<span class="proposer">
									<User size={12} />
									proposed by <strong>{u.proposer}</strong>
								</span>
								<span class="dot">·</span>
								<span>owner <code>{u.owner}</code></span>
								<span class="dot">·</span>
								<span>at block #{u.creation_height.toLocaleString()}</span>
							</div>
						</a>
						<div class="row-countdown">
							<span class="cd-label">Activates in</span>
							<Countdown targetUnixSec={tsToUnixSec(u.activation_ts)} />
							<span class="cd-sub">block #{u.activation_height.toLocaleString()}</span>
						</div>
						<div class="row-links">
							<a
								href={proposerTxUrl(u.proposer)}
								target="_blank"
								rel="noopener"
								title="Proposer account on explorer"
							>
								<ExternalLink size={14} />
								<span>Proposer</span>
							</a>
							<a href={codeIpfsUrl(u.code)} target="_blank" rel="noopener" title="New code on IPFS">
								<FileCode2 size={14} />
								<span>New code</span>
							</a>
							<a
								href={contractExplorerUrl(u.id)}
								target="_blank"
								rel="noopener"
								title="Contract on the VSC explorer"
							>
								<ExternalLink size={14} />
								<span>Explorer</span>
							</a>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</Card>

<style lang="scss">
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		font-family: 'Nunito Sans', sans-serif;
	}
	.lead {
		margin: 0;
		font-size: 0.88rem;
		color: var(--dash-text-secondary);
		max-width: 38rem;
		line-height: 1.45;
	}
	.mock-badge {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 0.2rem 0.45rem;
		border-radius: 4px;
		background: rgba(255, 200, 0, 0.18);
		color: #ffdc6b;
		border: 1px solid rgba(255, 200, 0, 0.35);
		flex-shrink: 0;
		cursor: help;
	}

	.section-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--dash-text-secondary);
		margin: 0 0 0.75rem;
		font-weight: 600;
	}
	.count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0;
		color: var(--dash-text-primary);
	}
	.count.pending {
		background: rgba(255, 170, 50, 0.22);
		color: #ffc48a;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		display: grid;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}
	.row.pending-row {
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'main countdown'
			'links links';
		border-color: rgba(255, 170, 50, 0.28);
		background: rgba(255, 170, 50, 0.04);
	}
	.row-main {
		grid-area: main;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.row-main:hover .title {
		color: #b0acff;
	}
	.row-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.title {
		font-size: 0.95rem;
		color: var(--dash-text-primary);
		transition: color 150ms ease;
	}
	.kind {
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.18rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--dash-text-secondary);
	}
	.kind.kind-pool {
		background: rgba(111, 106, 248, 0.22);
		color: #b0acff;
	}
	.kind.kind-bridge {
		background: rgba(60, 180, 230, 0.2);
		color: #8edcf4;
	}
	.kind.kind-gateway {
		background: rgba(150, 200, 100, 0.2);
		color: #c8e69b;
	}
	.kind.kind-oracle {
		background: rgba(230, 150, 200, 0.2);
		color: #f0adcf;
	}
	.kind.kind-governance {
		background: rgba(230, 150, 60, 0.22);
		color: #ffc48a;
	}
	.kind.kind-other {
		background: rgba(255, 255, 255, 0.08);
		color: var(--dash-text-secondary);
	}

	.row-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--dash-text-secondary);
	}
	.row-meta .proposer {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.row-meta code {
		font-family: 'Noto Sans Mono', monospace;
		font-size: 0.78em;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		color: var(--dash-text-primary);
	}
	.dot {
		opacity: 0.5;
	}

	.row-countdown {
		grid-area: countdown;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.15rem;
	}
	.cd-label {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dash-text-secondary);
		font-weight: 600;
	}
	.cd-sub {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
	}

	.row-links {
		grid-area: links;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding-top: 0.5rem;
		border-top: 1px dashed rgba(255, 255, 255, 0.08);
	}
	.row-links a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		padding: 0.3rem 0.55rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--dash-text-primary);
		text-decoration: none;
		transition: background-color 150ms ease;
	}
	.row-links a:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--dash-text-muted);
		font-style: italic;
	}
	.empty.loading {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-style: normal;
	}
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 600px) {
		.row.pending-row {
			grid-template-columns: 1fr;
			grid-template-areas:
				'main'
				'countdown'
				'links';
		}
		.row-countdown {
			align-items: flex-start;
		}
	}
</style>
