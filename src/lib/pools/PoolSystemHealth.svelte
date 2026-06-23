<script lang="ts">
	import { Lightbulb, ChevronDown, Droplet, ShieldCheck } from '@lucide/svelte';
	import type { SystemHealth } from './systemHealth';

	let { health }: { health: SystemHealth } = $props();

	let open = $state(false);
	let amount = $state(1000);

	let nodeShare = $derived(health.nodeSharePct);
	let lpShare = $derived(health.lpSharePct);
	let nodeApr = $derived(health.nodeAprPct);

	// Representative LP yield for the panel: average across pools (they're close).
	let lpAprs = $derived(health.pools.map((p) => p.lpAprPct).filter((x): x is number => x != null));
	let lpApr = $derived(lpAprs.length ? lpAprs.reduce((a, b) => a + b, 0) / lpAprs.length : null);

	// Personal what-if: same money, the two ways to earn it.
	let stakeGain = $derived(nodeApr != null ? (amount * nodeApr) / 100 : null);
	let lpGain = $derived(lpApr != null ? (amount * lpApr) / 100 : null);

	// Donut geometry: r tuned so the circumference ≈ 100, so the dash array can
	// use the share percentages directly.
	const R = 15.915;
	let nodeArc = $derived(nodeShare ?? 0);

	const fmtPct = (n: number | null, d = 1) => (n == null ? '—' : `${n.toFixed(d)}%`);
	const fmtUsd = (n: number | null) =>
		n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;
</script>

<section class="health">
	<button class="head" aria-expanded={open} onclick={() => (open = !open)}>
		<Lightbulb size={18} class="bulb" />
		<span class="title">Where should I put my money?</span>
		<span class="head-sub">current · last 7 days</span>
		<ChevronDown size={18} class="chev {open ? 'up' : ''}" />
	</button>

	{#if open}
		<div class="body">
			<p class="lede">
				Pools are short on node collateral right now, so most swap fees
				{#if nodeShare != null}(about {fmtPct(nodeShare, 0)}){/if} are going to node operators. Here's
				how the two ways to earn compare today:
			</p>

			<div class="cols">
				{#if nodeShare != null}
					<div class="donut-wrap">
						<svg
							viewBox="0 0 36 36"
							class="donut"
							role="img"
							aria-label="Fee split: {fmtPct(nodeShare, 0)} to nodes, {fmtPct(lpShare, 0)} to LPs"
						>
							<circle cx="18" cy="18" r={R} fill="none" class="ring-lp" stroke-width="4" />
							<circle
								cx="18"
								cy="18"
								r={R}
								fill="none"
								class="ring-node"
								stroke-width="4"
								stroke-dasharray="{nodeArc} {100 - nodeArc}"
								stroke-dashoffset="25"
							/>
						</svg>
						<div class="donut-legend">
							<span><span class="dot node-bg"></span>Nodes {fmtPct(nodeShare, 0)}</span>
							<span><span class="dot lp-bg"></span>LPs {fmtPct(lpShare, 0)}</span>
						</div>
					</div>
				{/if}

				<div class="options">
					<div class="opt">
						<div class="opt-head"><Droplet size={18} /> Provide liquidity</div>
						<div class="opt-apr">{fmtPct(lpApr)} <span>/ yr</span></div>
						<div class="opt-sub">
							Low right now — LPs earn little until the 1.5:1 collateral/liquidity ratio is
							re-established.
						</div>
					</div>
					<div class="opt best">
						<span class="badge">Best move now</span>
						<div class="opt-head"><ShieldCheck size={18} /> Stake Hive in nodes</div>
						<div class="opt-apr accent">{fmtPct(nodeApr)} <span>/ yr</span></div>
						<div class="opt-sub">
							Earns the most <em>and</em> pushes fees back toward LPs.
						</div>
					</div>
				</div>
			</div>

			<div class="predict">
				<div class="predict-row">
					<label for="predict-amt">If you put in</label>
					<input
						id="predict-amt"
						type="range"
						min="100"
						max="10000"
						step="100"
						bind:value={amount}
					/>
					<span class="amt">{fmtUsd(amount)}</span>
				</div>
				<div class="predict-out">
					<div class="po">
						<span class="po-label"><span class="dot lp-bg"></span>as liquidity</span>
						<span class="po-val">≈ {fmtUsd(lpGain)} / yr</span>
					</div>
					<div class="po">
						<span class="po-label"><span class="dot node-bg"></span>as collateral</span>
						<span class="po-val accent">≈ {fmtUsd(stakeGain)} / yr</span>
					</div>
				</div>
			</div>

			<p class="note">
				Estimates from the last 7 days of fees. Actual returns vary; safe-band and APR figures are
				provisional.
			</p>
		</div>
	{/if}
</section>

<style>
	.health {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		box-shadow: var(--dash-card-shadow);
		margin-top: 1rem;
		overflow: hidden;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.9rem 1.1rem;
		background: var(--dash-surface-alt);
		border: none;
		cursor: pointer;
		color: var(--dash-text-primary);
		font: inherit;
	}
	.head :global(.bulb) {
		color: var(--dash-accent-purple);
	}
	.title {
		font-weight: 600;
		font-size: 0.95rem;
	}
	.head-sub {
		font-size: 0.72rem;
		color: var(--dash-text-muted);
		margin-left: 0.5rem;
	}
	.head :global(.chev) {
		margin-left: auto;
		color: var(--dash-text-secondary);
		transition: transform 0.15s ease;
	}
	.head :global(.chev.up) {
		transform: rotate(180deg);
	}
	.body {
		padding: 1.1rem;
	}
	.lede {
		margin: 0 0 1.1rem;
		font-size: 0.88rem;
		line-height: 1.55;
		color: var(--dash-text-secondary);
	}
	.cols {
		display: flex;
		gap: 1.25rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.donut-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.donut {
		width: 104px;
		height: 104px;
	}
	.ring-lp {
		stroke: var(--dash-accent-green);
	}
	.ring-node {
		stroke: var(--dash-accent-purple);
	}
	.donut-legend {
		display: flex;
		gap: 0.85rem;
		font-size: 0.74rem;
		color: var(--dash-text-secondary);
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		margin-right: 4px;
	}
	.node-bg {
		background: var(--dash-accent-purple);
	}
	.lp-bg {
		background: var(--dash-accent-green);
	}
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
		flex: 1;
		min-width: 240px;
	}
	.opt {
		position: relative;
		border: 1px solid var(--dash-card-border);
		border-radius: 12px;
		padding: 0.85rem;
	}
	.opt.best {
		border: 2px solid var(--dash-accent-purple);
	}
	.badge {
		position: absolute;
		top: -10px;
		left: 12px;
		font-size: 0.7rem;
		padding: 0.1rem 0.55rem;
		border-radius: 8px;
		background: var(--dash-accent-purple);
		color: #fff;
	}
	.opt-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--dash-text-primary);
		margin-bottom: 0.4rem;
	}
	.opt-apr {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.opt-apr span {
		font-size: 0.72rem;
		font-weight: 400;
		color: var(--dash-text-muted);
	}
	.opt-apr.accent {
		color: var(--dash-accent-purple);
	}
	.opt-sub {
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--dash-text-secondary);
		margin-top: 0.3rem;
	}
	.muted {
		color: var(--dash-text-muted);
	}
	.predict {
		margin-top: 1.1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.predict-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.predict-row label {
		font-size: 0.82rem;
		color: var(--dash-text-secondary);
		white-space: nowrap;
	}
	.predict-row input {
		flex: 1;
		accent-color: var(--dash-accent-purple);
	}
	.amt {
		font-size: 0.85rem;
		font-weight: 600;
		min-width: 64px;
		text-align: right;
		color: var(--dash-text-primary);
	}
	.predict-out {
		display: flex;
		gap: 1.5rem;
		margin-top: 0.7rem;
	}
	.po {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.po-label {
		font-size: 0.74rem;
		color: var(--dash-text-secondary);
	}
	.po-val {
		font-size: 1rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.po-val.accent {
		color: var(--dash-accent-purple);
	}
	.note {
		margin: 1rem 0 0;
		font-size: 0.72rem;
		color: var(--dash-text-muted);
	}
</style>
