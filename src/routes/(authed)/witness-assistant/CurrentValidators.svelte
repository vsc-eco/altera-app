<!--
	Block production — a live "who's producing now / up next" feed for the witness
	committee, plus the full epoch committee tucked into an expandable.

	Real-time path (all first-party on vsc.eco):
	  • `localNodeInfo.last_processed_block` → current head height
	  • `witnessSchedule(height)` → [{ account, bn }] — the producer per slot
	  current producer = the slot with the latest `bn` ≤ head; the rest are "up next".
	  Polls only the cheap head every 10s (the schedule is cached — slots advance
	  ~every 30s), pausing while the tab is hidden. Avatars are direct Hive CDN
	  images (no API call) so they add no load.

	The committee + epoch (`electionByBlockHeight`) is secondary info in the
	expandable, fetched once on mount.
-->
<script lang="ts">
	import { NodeHeadStore, WitnessScheduleStore, CurrentElectionStore } from '$houdini';
	import Card from '$lib/cards/Card.svelte';
	import { getHiveAccountUrl, getHiveAvatarUrl, getVscExplorerUrl } from '$lib/constants';
	import { Boxes, ChevronRight } from '@lucide/svelte';

	type Slot = { account: string; bn: number };

	let head = $state<number | null>(null);
	let schedule = $state<Slot[]>([]);
	let prodLoad = $state<'loading' | 'loaded' | 'error'>('loading');
	let prodError = $state('');

	let epoch = $state<number | null>(null);
	let committee = $state<string[]>([]);
	let committeeOpen = $state(false);

	const currentProducer = $derived.by<Slot | null>(() => {
		if (head == null || schedule.length === 0) return null;
		const past = schedule.filter((s) => s.bn <= head!);
		return past.length ? past[past.length - 1] : null;
	});
	const upcoming = $derived(head == null ? [] : schedule.filter((s) => s.bn > head!).slice(0, 5));

	// The schedule covers ~120 slots forward (~an hour), so it's stable — fetch it
	// only when we have none or we've advanced past its end, NOT every tick.
	async function fetchSchedule(height: number) {
		const s = await new WitnessScheduleStore().fetch({
			variables: { height },
			policy: 'NetworkOnly'
		});
		if (s.errors?.length) throw new Error(s.errors[0].message);
		schedule = (s.data?.witnessSchedule ?? [])
			.filter((x): x is { account: string; bn: number } => x.account != null)
			.map((x) => ({ account: x.account, bn: x.bn }))
			.sort((a, b) => a.bn - b.bn);
	}

	// One poll: refresh the (cheap) head; only (re)fetch the schedule when needed.
	// `busy` guards against overlapping requests piling up if a query is slow.
	let busy = false;
	async function tick() {
		if (busy) return;
		busy = true;
		try {
			const h = await new NodeHeadStore().fetch({ policy: 'NetworkOnly' });
			if (h.errors?.length) throw new Error(h.errors[0].message);
			const bh = h.data?.localNodeInfo?.last_processed_block;
			if (bh == null) throw new Error('no head height');
			head = bh;
			const maxBn = schedule.length ? schedule[schedule.length - 1].bn : 0;
			if (schedule.length === 0 || bh >= maxBn) await fetchSchedule(bh);
			prodLoad = 'loaded';
		} catch (e) {
			prodError = e instanceof Error ? e.message : String(e);
			prodLoad = 'error';
		} finally {
			busy = false;
		}
	}

	async function fetchCommittee() {
		try {
			const res = await new CurrentElectionStore().fetch({ policy: 'NetworkOnly' });
			const el = res.data?.electionByBlockHeight;
			epoch = el?.epoch ?? null;
			committee = (el?.members ?? []).map((m) => m.account);
		} catch {
			/* committee is secondary info — ignore failures, the live feed still shows */
		}
	}

	$effect(() => {
		tick();
		fetchCommittee();
		let id: ReturnType<typeof setInterval> | undefined;
		// Head only — a slot changes ~every 30s, so 10s polling is plenty live and
		// cheap (the heavy schedule query is cached, not re-fetched each tick).
		const start = () => (id ??= setInterval(tick, 10000));
		const stop = () => {
			clearInterval(id);
			id = undefined;
		};
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
</script>

<Card>
	<div class="head">
		<h3><Boxes size={18} /> Block production</h3>
		<a class="live-link" href={getVscExplorerUrl()} target="_blank" rel="noopener">Live blocks ↗</a>
	</div>

	{#if prodLoad === 'error'}
		<p class="empty error">Couldn't load the schedule: {prodError}</p>
	{:else if currentProducer}
		<div class="now-panel">
			<div class="now-head">
				<span class="now-dot" title="live"></span>
				<span class="now-label">Now producing</span>
			</div>
			<a
				class="now-account"
				href={getHiveAccountUrl(currentProducer.account)}
				target="_blank"
				rel="noopener"
			>
				<img
					class="avatar avatar-hero"
					src={getHiveAvatarUrl(currentProducer.account)}
					alt=""
					loading="lazy"
				/>
				<span class="now-id">
					<span class="now-name">@{currentProducer.account}</span>
					<span class="now-bn">block {currentProducer.bn.toLocaleString()}</span>
				</span>
			</a>
		</div>
		{#if upcoming.length}
			<div class="upnext">
				<span class="upnext-label">Up next</span>
				<span class="upnext-chain">
					{#each upcoming as s, i (s.bn)}
						{#if i > 0}<span class="arrow">→</span>{/if}
						<a
							href={getHiveAccountUrl(s.account)}
							target="_blank"
							rel="noopener"
							title="block {s.bn.toLocaleString()}"
						>
							<img
								class="avatar"
								src={getHiveAvatarUrl(s.account)}
								alt=""
								loading="lazy"
							/>@{s.account}</a
						>
					{/each}
				</span>
			</div>
		{/if}
	{:else}
		<div class="now-panel skeleton-panel" aria-hidden="true">
			<div class="now-head">
				<span class="now-dot"></span>
				<span class="skeleton skeleton-label"></span>
			</div>
			<div class="now-account">
				<span class="skeleton skeleton-avatar"></span>
				<span class="skeleton skeleton-name"></span>
			</div>
		</div>
	{/if}

	<button
		class="committee-toggle"
		class:open={committeeOpen}
		onclick={() => (committeeOpen = !committeeOpen)}
	>
		<ChevronRight size={14} />
		Validators this epoch{#if committee.length}&nbsp;({committee.length}){/if}{#if epoch !== null}&nbsp;·
			epoch
			{epoch}{/if}
	</button>
	{#if committeeOpen}
		{#if committee.length}
			<div class="validators">
				{#each committee as v (v)}
					<a class="validator" href={getHiveAccountUrl(v)} target="_blank" rel="noopener">
						<img class="avatar" src={getHiveAvatarUrl(v)} alt="" loading="lazy" />@{v}</a
					>
				{/each}
			</div>
		{:else}
			<p class="empty">Loading committee…</p>
		{/if}
	{/if}
</Card>

<style lang="scss">
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.85rem;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.05rem;
		font-family: 'Nunito Sans', sans-serif;
	}
	.live-link {
		font-size: 0.8rem;
		color: var(--dash-accent-purple, #b0acff);
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.live-link:hover {
		text-decoration: underline;
	}

	/* ── Now producing (live hero) ── */
	.now-panel {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.7rem 0.85rem;
		border-radius: 12px;
		background: rgba(143, 220, 155, 0.06);
		border: 1px solid rgba(143, 220, 155, 0.18);
		border-left: 3px solid var(--dash-accent-green, #8fdc9b);
	}
	.now-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.now-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--dash-accent-green, #8fdc9b);
		box-shadow: 0 0 0 0 rgba(143, 220, 155, 0.6);
		animation: pulse 1.8s ease-out infinite;
		flex-shrink: 0;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(143, 220, 155, 0.5);
		}
		70% {
			box-shadow: 0 0 0 6px rgba(143, 220, 155, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(143, 220, 155, 0);
		}
	}
	.now-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dash-text-secondary);
	}
	.now-account {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		width: fit-content;
		text-decoration: none;
	}
	.now-id {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		gap: 0.1rem;
	}
	.now-name {
		font-size: 1.15rem;
		font-weight: 700;
		font-family: 'Noto Sans Mono', monospace;
		color: var(--dash-text-primary);
	}
	.now-account:hover .now-name {
		color: #b0acff;
	}
	.now-bn {
		font-size: 0.72rem;
		color: var(--dash-text-muted);
		font-family: 'Noto Sans Mono', monospace;
	}
	/* Lightweight inline avatars (direct Hive CDN — no API call). */
	.avatar {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.08);
	}
	.avatar-hero {
		width: 38px;
		height: 38px;
	}
	/* Loading skeleton (mirrors the hero so the layout doesn't jump) */
	.skeleton-panel {
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.06);
		border-left-color: rgba(255, 255, 255, 0.12);
	}
	.skeleton {
		display: inline-block;
		border-radius: 6px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04),
			rgba(255, 255, 255, 0.1),
			rgba(255, 255, 255, 0.04)
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
	.skeleton-label {
		width: 96px;
		height: 0.7rem;
	}
	.skeleton-avatar {
		width: 38px;
		height: 38px;
		border-radius: 50%;
	}
	.skeleton-name {
		width: 150px;
		height: 1.15rem;
	}
	@media (prefers-reduced-motion: reduce) {
		.now-dot,
		.skeleton {
			animation: none;
		}
	}
	.upnext {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.55rem;
		font-size: 0.82rem;
	}
	.upnext-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dash-text-secondary);
	}
	.upnext-chain {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		font-family: 'Noto Sans Mono', monospace;
		a {
			display: inline-flex;
			align-items: center;
			gap: 0.3rem;
			color: var(--dash-text-primary);
			text-decoration: none;
		}
		a:hover {
			color: #b0acff;
		}
		.arrow {
			color: var(--dash-text-muted);
		}
	}

	/* ── Expandable committee ── */
	.committee-toggle {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 1rem;
		padding: 0.35rem 0;
		background: none;
		border: none;
		color: var(--dash-text-secondary);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		:global(svg) {
			transition: transform 150ms ease;
		}
	}
	.committee-toggle:hover {
		color: var(--dash-text-primary);
	}
	.committee-toggle.open :global(svg) {
		transform: rotate(90deg);
	}
	.validators {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}
	.validator {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-family: 'Noto Sans Mono', monospace;
		color: var(--dash-text-primary);
		text-decoration: none;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.18rem 0.5rem;
		border-radius: 8px;
	}
	.validator:hover {
		border-color: var(--dash-accent-purple, #6f6af8);
		color: #b0acff;
	}
	.empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--dash-text-muted);
		font-style: italic;
	}
	.empty.error {
		color: var(--error-text, #ff8585);
		font-style: normal;
	}
</style>
