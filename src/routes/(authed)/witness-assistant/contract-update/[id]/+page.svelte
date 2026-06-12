<!--
	Contract-update detail page.

	Routed by contract id (the `id` field of PendingContractUpdate).
	Shows the queued WASM CID, the proposer + owner, the timelock window
	(creation_height + activation_height + activation_ts), and audit
	links for IPFS code fetch and code diff.

	Data shape aligned with `findPendingContractUpdates` (go-vsc-node
	PR #210). Reads from `mockData.ts` until that field is live.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Card from '$lib/cards/Card.svelte';
	import Countdown from '$lib/witness/contractUpdates/Countdown.svelte';
	import { loadUpdateById } from '$lib/witness/contractUpdates/loader';
	import { tsToUnixSec, type ContractUpdateView } from '$lib/witness/contractUpdates/types';
	import {
		codeDiffSearchUrl,
		codeIpfsUrl,
		contractExplorerUrl,
		proposerTxUrl
	} from '$lib/witness/contractUpdates/auditLinks';
	import { ArrowLeft, ExternalLink, FileCode2, GitCompare, Loader2, User } from '@lucide/svelte';

	let state = $state<
		{ source: 'loading' } | { source: 'loaded'; update: ContractUpdateView | undefined }
	>({ source: 'loading' });

	$effect(() => {
		const id = page.params.id;
		// Stale-response guard: rapid navigation between detail routes could
		// otherwise let a slower earlier response overwrite the newer one.
		let stale = false;
		loadUpdateById(id).then((update) => {
			if (!stale) state = { source: 'loaded', update };
		});
		return () => {
			stale = true;
		};
	});

	const update = $derived(state.source === 'loaded' ? state.update : undefined);

	function fmtIsoLocal(iso: string): string {
		// Bare ISO timestamps from the node are UTC — route through
		// tsToUnixSec (which appends Z) before converting to local display,
		// otherwise the shown time shifts by the user's UTC offset (same
		// bug class the countdown had).
		return new Date(tsToUnixSec(iso) * 1000).toLocaleString();
	}
</script>

<svelte:head>
	<title>
		{update?.metadata?.name ?? 'Contract update'} · Witness
	</title>
</svelte:head>

<div class="wrap">
	<a class="back" href="/witness-assistant">
		<ArrowLeft size={14} />
		Back to witness page
	</a>

	{#if state.source === 'loading'}
		<Card>
			<p class="loading-row">
				<Loader2 size={14} class="spin" />
				Loading update details…
			</p>
		</Card>
	{:else if !update}
		<Card>
			<h2>No pending update</h2>
			<p>
				No pending contract update is queued for <code>{page.params.id}</code>. It may have already
				activated, been cancelled, or never existed.
			</p>
		</Card>
	{:else}
		<Card>
			<header class="head">
				<div>
					<div class="tags">
						<span class="kind kind-{update.metadata?.category ?? 'other'}">
							{update.metadata?.category ?? 'contract'}
						</span>
						<span class="status status-pending">pending</span>
					</div>
					<h2>
						Upgrade · {update.metadata?.name ??
							update.chainName ??
							`contract ${update.id.slice(0, 12)}…`}
					</h2>
					{#if update.metadata?.description}
						<p class="lead">{update.metadata.description}</p>
					{:else}
						<p class="lead">
							No registry entry for this contract — only on-chain fields are shown.
						</p>
					{/if}
				</div>
				<div class="countdown-box">
					<span class="cd-label">Activates in</span>
					<Countdown targetUnixSec={tsToUnixSec(update.activation_ts)} />
					<span class="cd-sub">block #{update.activation_height.toLocaleString()}</span>
				</div>
			</header>

			<dl class="meta">
				<div>
					<dt>Contract id</dt>
					<dd>
						<code>{update.id}</code>
						<a
							class="inline-link"
							href={contractExplorerUrl(update.id)}
							target="_blank"
							rel="noopener"
						>
							view on explorer
							<ExternalLink size={12} />
						</a>
					</dd>
				</div>
				<div>
					<dt>Proposer</dt>
					<dd>
						<User size={14} />
						<strong>{update.proposer}</strong>
						<a
							class="inline-link"
							href={proposerTxUrl(update.proposer)}
							target="_blank"
							rel="noopener"
						>
							view on hivehub
							<ExternalLink size={12} />
						</a>
					</dd>
				</div>
				<div>
					<dt>Owner</dt>
					<dd><code>{update.owner}</code></dd>
				</div>
				<div>
					<dt>Queued at</dt>
					<dd>block #{update.creation_height.toLocaleString()}</dd>
				</div>
				<div>
					<dt>Activates at</dt>
					<dd>
						block #{update.activation_height.toLocaleString()}
						<span class="muted">· {fmtIsoLocal(update.activation_ts)}</span>
					</dd>
				</div>
			</dl>
		</Card>

		<Card>
			<h3>Exact code</h3>
			<p class="lead">
				Verify what's about to execute by fetching the WASM blobs from IPFS and comparing them
				against the source.
			</p>

			<ul class="code-links">
				<li>
					<FileCode2 size={16} />
					<div class="link-body">
						<div class="link-row">
							<span class="link-label">New code (WASM)</span>
							<a href={codeIpfsUrl(update.code)} target="_blank" rel="noopener">
								ipfs.io/ipfs/{update.code.slice(0, 14)}…
								<ExternalLink size={12} />
							</a>
						</div>
						<code class="cid">{update.code}</code>
					</div>
				</li>
				{#if update.previousCode}
					<li>
						<FileCode2 size={16} />
						<div class="link-body">
							<div class="link-row">
								<span class="link-label">Previous code (WASM)</span>
								<a href={codeIpfsUrl(update.previousCode)} target="_blank" rel="noopener">
									ipfs.io/ipfs/{update.previousCode.slice(0, 14)}…
									<ExternalLink size={12} />
								</a>
							</div>
							<code class="cid">{update.previousCode}</code>
						</div>
					</li>
					<li>
						<GitCompare size={16} />
						<div class="link-body">
							<div class="link-row">
								<span class="link-label">Diff</span>
								<a
									href={codeDiffSearchUrl(update.previousCode, update.code)}
									target="_blank"
									rel="noopener"
								>
									compare CIDs
									<ExternalLink size={12} />
								</a>
							</div>
							<p class="hint">
								No public WASM diff tool integrated yet — link is a starting point.
							</p>
						</div>
					</li>
				{:else}
					<li class="muted-row">
						<FileCode2 size={16} />
						<div class="link-body">
							<span class="link-label muted">Previous code</span>
							<p class="hint">
								Current on-chain code CID isn't joined yet — will be fetched via
								<code>findContract(byId)</code> alongside the real query.
							</p>
						</div>
					</li>
				{/if}
			</ul>
		</Card>
	{/if}
</div>

<style lang="scss">
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 56rem;
		padding-bottom: 3rem;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--dash-text-secondary);
		text-decoration: none;
		font-size: 0.88rem;
		width: fit-content;
		padding: 0.3rem 0.5rem;
		margin-left: -0.5rem;
		border-radius: 6px;
		transition: background-color 150ms ease;
	}
	.back:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--dash-text-primary);
	}

	.head {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.25rem;
		align-items: flex-start;
	}
	.tags {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}
	h2 {
		margin: 0 0 0.25rem;
		font-size: 1.35rem;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	h3 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	.lead {
		margin: 0 0 1rem;
		color: var(--dash-text-secondary);
		font-size: 0.88rem;
		line-height: 1.5;
		max-width: 38rem;
	}

	.kind,
	.status {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.22rem 0.55rem;
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
	.status-pending {
		background: rgba(255, 170, 50, 0.22);
		color: #ffc48a;
	}

	.countdown-box {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
		padding: 0.65rem 0.9rem;
		border-radius: 10px;
		background: rgba(255, 170, 50, 0.08);
		border: 1px solid rgba(255, 170, 50, 0.28);
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

	.meta {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 0.65rem 1rem;
		margin: 0;
	}
	.meta > div {
		display: contents;
	}
	.meta dt {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dash-text-secondary);
		font-weight: 600;
		padding-top: 0.15rem;
	}
	.meta dd {
		margin: 0;
		color: var(--dash-text-primary);
		font-size: 0.9rem;
		line-height: 1.5;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.meta code,
	.cid {
		font-family: 'Noto Sans Mono', monospace;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.82em;
		word-break: break-all;
	}
	.muted {
		color: var(--dash-text-muted);
		font-weight: 400;
	}
	.inline-link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: #b0acff;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.inline-link:hover {
		text-decoration: underline;
	}

	.code-links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.code-links li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.code-links .muted-row {
		opacity: 0.7;
	}
	.link-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.link-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.link-label {
		font-weight: 600;
		font-size: 0.88rem;
	}
	.link-row a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: #b0acff;
		font-size: 0.82rem;
		text-decoration: none;
	}
	.link-row a:hover {
		text-decoration: underline;
	}
	.cid {
		background: rgba(0, 0, 0, 0.25);
		padding: 0.4rem 0.55rem;
		font-size: 0.75rem;
		color: var(--dash-text-secondary);
		display: block;
	}
	.hint {
		margin: 0;
		font-size: 0.78rem;
		color: var(--dash-text-muted);
		font-style: italic;
	}

	.loading-row {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--dash-text-secondary);
		font-size: 0.9rem;
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
		.head {
			flex-direction: column;
		}
		.countdown-box {
			align-self: flex-start;
		}
		.meta {
			grid-template-columns: 1fr;
		}
		.meta > div {
			display: block;
			padding-bottom: 0.5rem;
		}
		.meta dd {
			margin-top: 0.15rem;
		}
	}
</style>
