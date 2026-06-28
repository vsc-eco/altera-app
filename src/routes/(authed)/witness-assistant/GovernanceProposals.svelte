<!--
	Governance Proposals panel — lists the currently OPEN witness-vote
	governance proposals (reserve payouts + slash restorations) from the
	`FindGovernanceProposals` Houdini query and lets a signed-in witness
	approve each one with a single Active-key `vsc.reserve_vote` custom_json
	(built in $lib/magiTransactions/hive — same signing path as every other
	Hive op). Only Hive accounts can vote; EVM logins see a notice.
-->
<script lang="ts">
	import {
		FindGovernanceProposalsStore,
		CurrentElectionStore,
		type FindGovernanceProposals$result
	} from '$houdini';
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	import { reserveVoteTx } from '$lib/magiTransactions/hive';
	import { Landmark, Loader2, Check } from '@lucide/svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import WaveLoading from '$lib/components/WaveLoading.svelte';

	type Proposal = FindGovernanceProposals$result['findGovernanceProposals'][number];

	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);

	// Elected witness set for the current consensus election. Only its members
	// may cast a governance vote — the on-chain reserve_vote op rejects everyone
	// else, so we gate the UI to match (and explain why). `null` = not yet
	// loaded; we fail CLOSED (no vote until membership is confirmed).
	let witnessAccounts = $state<Set<string> | null>(null);
	let witnessLoadError = $state(false);
	async function fetchWitnesses() {
		try {
			const res = await new CurrentElectionStore().fetch({ policy: 'NetworkOnly' });
			if (res.errors?.length) throw new Error(res.errors[0].message);
			const members = res.data?.electionByBlockHeight?.members ?? [];
			witnessAccounts = new Set(members.map((m) => m.account));
			witnessLoadError = false;
		} catch (e) {
			witnessLoadError = true;
			console.error('Failed to load current election members', e);
		}
	}

	let isWitness = $derived(!!username && witnessAccounts?.has(username) === true);
	// A reserve_vote is a Hive Active-key custom_json — needs a Hive account
	// (Aioha provider, not EVM) AND membership in the elected witness set.
	let canVote = $derived(!!username && !!auth.value?.aioha && isWitness);

	let load = $state<'loading' | 'loaded' | 'error'>('loading');
	let loadError = $state('');
	let proposals = $state<Proposal[]>([]);

	// Per-proposal vote UI state, keyed by proposalId.
	type VoteUi = { busy: boolean; status: string; error: string };
	let voteState = $state<Record<string, VoteUi>>({});
	const uiFor = (id: string): VoteUi => voteState[id] ?? { busy: false, status: '', error: '' };

	async function fetchProposals() {
		await new FindGovernanceProposalsStore()
			.fetch({
				variables: { filterOptions: { byStatus: 'open', limit: 10 } },
				policy: 'NetworkOnly'
			})
			.then((res) => {
				if (res.errors?.length) throw new Error(res.errors[0].message);
				proposals = [...(res.data?.findGovernanceProposals ?? [])];
				load = 'loaded';
			})
			.catch((e) => {
				loadError = e instanceof Error ? e.message : String(e);
				load = 'error';
			});
	}

	// One poll tick: refresh proposals, and keep retrying the election fetch
	// until the committee loads (so a transient failure self-heals).
	function tick() {
		fetchProposals();
		if (witnessAccounts === null) fetchWitnesses();
	}

	$effect(() => {
		tick();
		let intervalId: ReturnType<typeof setInterval> | undefined;
		const start = () => (intervalId ??= setInterval(tick, 2000));
		const stop = () => {
			clearInterval(intervalId);
			intervalId = undefined;
		};
		// Pause polling while the tab is hidden; resume (with an immediate
		// refresh) when it returns, so we don't churn the API in the background.
		const onVisibility = () => {
			if (document.hidden) stop();
			else {
				tick();
				start();
			}
		};
		start();
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	function hasVoted(p: Proposal): boolean {
		return !!username && p.votes.some((v) => v.voter === username);
	}

	async function vote(p: Proposal) {
		if (!username || !auth.value?.aioha) return;
		voteState[p.proposalId] = { busy: true, status: 'Awaiting signature…', error: '' };
		const res = await reserveVoteTx(username, p.proposalId, auth.value.aioha);
		if (!res.success) {
			voteState[p.proposalId] = { busy: false, status: '', error: res.error };
			return;
		}
		voteState[p.proposalId] = { busy: false, status: 'Vote broadcasted!', error: '' };
		// Refetch so the new vote (and any resulting status change) is reflected.
		fetchProposals();
	}

	function shortId(id: string): string {
		return id.length > 24 ? `${id.slice(0, 16)}…${id.slice(-6)}` : id;
	}

	function typeLabel(type: string): string {
		if (type === 'reserve_payout') return 'Reserve payout';
		if (type === 'slash_restore') return 'Slash restoration';
		return type;
	}
</script>

<Card>
	<header class="head">
		<div>
			<h3>
				<Landmark size={18} />
				Governance proposals
				<InfoTooltip>
					Open witness-vote proposals — reserve disbursements and wrongful-slash restorations.
					Voting signs a <code>vsc.reserve_vote</code> custom_json with your witness account's
					Active key. <a href="https://docs.vsc.eco" target="_blank" rel="noopener">Learn more →</a>
				</InfoTooltip>
			</h3>
			<p class="lead">
				Review each open proposal and cast your approval vote. A vote is final once broadcast.
			</p>
		</div>
	</header>

	{#if !canVote}
		<p class="notice">
			{#if !username}
				Governance voting requires a Hive witness account. Please <a href="/logout">logout</a> and sign
				in with a Hive account to vote.
			{:else if !auth.value?.aioha}
				Governance voting needs your Hive Active key — connect with a Hive wallet (Keychain,
				PeakVault, …) to vote.
			{:else if witnessLoadError}
				Couldn't verify your witness status — retrying. Voting stays disabled until the current
				election loads.
			{:else if witnessAccounts === null}
				Verifying witness status…
			{:else}
				Only elected witnesses can vote on governance proposals. Your account (<code
					>@{username}</code
				>) isn't in the current consensus committee.
			{/if}
		</p>
	{/if}

	{#if load === 'loading'}
		<p class="empty loading">
			<WaveLoading />Loading open proposals…
		</p>
	{:else if load === 'error'}
		<p class="empty error">Couldn't load governance proposals: {loadError}</p>
	{:else if proposals.length === 0}
		<p class="empty">No open governance proposals right now.</p>
	{:else}
		<ul class="list">
			{#each proposals as p (p.proposalId)}
				{@const ui = uiFor(p.proposalId)}
				{@const voted = hasVoted(p)}
				<li class="row">
					<div class="row-main">
						<div class="row-head">
							<span class="kind kind-{p.type}">{typeLabel(p.type)}</span>
							<strong class="amount"
								>{new CoinAmount(p.amount, Coin.hive, true).toPrettyString()}</strong
							>
							<span class="votes">{p.votes.length} vote{p.votes.length === 1 ? '' : 's'}</span>
						</div>
						<div class="row-meta">
							{#if p.type === 'reserve_payout'}
								<span>to <code>@{p.recipient}</code></span>
								{#if p.reason}<span class="dot">·</span><span class="reason">{p.reason}</span>{/if}
							{:else if p.type === 'slash_restore'}
								<span>restore <code>@{p.slashedAccount}</code></span>
								{#if p.evidenceKind}<span class="dot">·</span><span>{p.evidenceKind}</span>{/if}
							{/if}
							<span class="dot">·</span>
							<span title={p.proposalId}>id <code>{shortId(p.proposalId)}</code></span>
						</div>
						{#if ui.error}<p class="row-error">{ui.error}</p>{/if}
						{#if ui.status}<p class="row-status">{ui.status}</p>{/if}
					</div>
					<div class="row-action">
						{#if voted}
							<span class="voted"><Check size={15} /> Voted</span>
						{:else}
							<PillButton
								styleType="invert"
								theme="primary"
								disabled={!canVote || ui.busy}
								onclick={() => vote(p)}
							>
								{#if ui.busy}
									<Loader2 size={15} class="spin" /> Signing…
								{:else}
									Vote
								{/if}
							</PillButton>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Card>

<style lang="scss">
	.head {
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
	.notice {
		margin: 0 0 1rem;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
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
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}
	.row-main {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}
	.row-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.amount {
		font-size: 0.98rem;
		color: var(--dash-text-primary);
	}
	.votes {
		font-size: 0.78rem;
		color: var(--dash-text-secondary);
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
	.kind.kind-reserve_payout {
		background: rgba(111, 106, 248, 0.22);
		color: #b0acff;
	}
	.kind.kind-slash_restore {
		background: rgba(230, 150, 60, 0.22);
		color: #ffc48a;
	}
	.row-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--dash-text-secondary);
	}
	.row-meta code {
		font-family: 'Noto Sans Mono', monospace;
		font-size: 0.78em;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		color: var(--dash-text-primary);
	}
	.reason {
		font-style: italic;
	}
	.dot {
		opacity: 0.5;
	}
	.row-action {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}
	.voted {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: #8fdc9b;
	}
	.row-error {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--error-text, #ff8585);
	}
	.row-status {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--dash-accent-purple, #b0acff);
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
	.empty.error {
		color: var(--error-text, #ff8585);
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
		.row {
			grid-template-columns: 1fr;
		}
		.row-action {
			justify-content: flex-start;
		}
	}
</style>
