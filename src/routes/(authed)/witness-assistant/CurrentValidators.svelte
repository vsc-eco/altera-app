<!--
	Current validators — a compact box showing the elected committee securing the
	network this epoch (`electionByBlockHeight.members`).

	NOTE: the per-block producer *schedule* is computed inside the node
	(state-engine `GetSchedule`) and isn't exposed via GraphQL, so we can't show
	"who is producing block N right now" from the frontend yet. This shows the
	committee (per-epoch) instead — each validator links to their hivehub account,
	with a link out to the VSC explorer for the live block feed. Refreshes every
	30s (and on tab focus). Upgrade to true per-block once the node exposes a
	current-producer query.
-->
<script lang="ts">
	import { CurrentElectionStore } from '$houdini';
	import Card from '$lib/cards/Card.svelte';
	import { getHiveAccountUrl, getVscExplorerUrl } from '$lib/constants';
	import { Users } from '@lucide/svelte';

	let epoch = $state<number | null>(null);
	let validators = $state<string[]>([]);
	let load = $state<'loading' | 'loaded' | 'error'>('loading');
	let loadError = $state('');

	async function fetchValidators() {
		try {
			const res = await new CurrentElectionStore().fetch({ policy: 'NetworkOnly' });
			if (res.errors?.length) throw new Error(res.errors[0].message);
			const el = res.data?.electionByBlockHeight;
			epoch = el?.epoch ?? null;
			validators = (el?.members ?? []).map((m) => m.account);
			load = 'loaded';
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
			load = 'error';
		}
	}

	$effect(() => {
		fetchValidators();
		let id: ReturnType<typeof setInterval> | undefined;
		const start = () => (id ??= setInterval(fetchValidators, 30000));
		const stop = () => {
			clearInterval(id);
			id = undefined;
		};
		// Pause while the tab is hidden; refresh on return.
		const onVisibility = () => {
			if (document.hidden) stop();
			else {
				fetchValidators();
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
		<h3>
			<Users size={18} />
			Current validators
			{#if epoch !== null}<span class="epoch">epoch {epoch}</span>{/if}
		</h3>
		<a class="live-link" href={getVscExplorerUrl()} target="_blank" rel="noopener">Live blocks ↗</a>
	</div>

	{#if load === 'loading'}
		<p class="empty">Loading validators…</p>
	{:else if load === 'error'}
		<p class="empty error">Couldn't load validators: {loadError}</p>
	{:else if validators.length === 0}
		<p class="empty">No active committee right now.</p>
	{:else}
		<div class="validators">
			{#each validators as v (v)}
				<a class="validator" href={getHiveAccountUrl(v)} target="_blank" rel="noopener">@{v}</a>
			{/each}
		</div>
		<p class="count">{validators.length} witnesses securing the network this epoch.</p>
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
	.epoch {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--dash-text-secondary);
		background: rgba(255, 255, 255, 0.06);
		padding: 0.12rem 0.45rem;
		border-radius: 6px;
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
	.validators {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.validator {
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
	.count {
		margin: 0.65rem 0 0;
		font-size: 0.78rem;
		color: var(--dash-text-secondary);
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
