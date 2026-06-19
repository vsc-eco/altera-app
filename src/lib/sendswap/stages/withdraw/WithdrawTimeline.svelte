<!--
	Withdraw flow — production timeline.

	Asset-first sibling of DepositTimeline.svelte (the 3-step Asset → Destination
	→ Send timeline), wired to the SAME real txState/broadcast plumbing the
	legacy WithdrawOptions used. Differences from deposit, by design:
	  • step 1 lists ONLY assets the user holds on Magi (you can't withdraw what
	    you don't have) — each chip shows its live balance
	  • step 2 destinations filter to what the chosen asset supports (HIVE/HBD →
	    Hive mainnet; BTC → Bitcoin mainnet, Lightning, Coinbase-soon)
	  • step 3 mounts the REAL per-destination components (HiveMainnetWithdraw
	    with lockAsset, BitcoinMainnetWithdraw, KeepsatsWithdraw)
	  • selections route through useWithdrawState() + initWithdrawStateForDestination
	    so the broadcast payload matches the legacy menu

	The recent-withdrawals rail + FAQ live in WithdrawSidebar.svelte (page-level
	column) — this component is the flow only.
-->
<script lang="ts">
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { untrack, type ComponentProps } from 'svelte';
	import { Check, Clock, Info, Receipt } from '@lucide/svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';

	import { Coin, Network } from '../../utils/sendOptions';
	import { useWithdrawState } from '../../utils/txState.svelte';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { initWithdrawStateForDestination, type WithdrawDestination } from './withdrawInit';
	import HiveMainnetWithdraw from './HiveMainnetWithdraw.svelte';
	import BitcoinMainnetWithdraw from './BitcoinMainnetWithdraw.svelte';
	import KeepsatsWithdraw from './KeepsatsWithdraw.svelte';
	import type NavButtons from '$lib/sendswap/components/NavButtons.svelte';

	// Props contract matches WithdrawOptions so the StepsMachine wiring is a
	// one-line swap. onHomePage / customButtons MUST stay $bindable.
	let {
		editStage,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
		customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	const txState = useWithdrawState();

	// ─── Step machine (Zag) — drives the timeline indicators ─────────────────
	const stepDefs = [
		{ id: 'asset', label: 'I want to withdraw' },
		{ id: 'destination', label: 'To' },
		{ id: 'send', label: 'Send' }
	] as const;

	const stepId = $props.id();
	const stepsService = useMachine(steps.machine, {
		id: stepId,
		orientation: 'vertical',
		count: stepDefs.length,
		linear: true
	});
	const stepsApi = $derived(steps.connect(stepsService, normalizeProps));

	// ─── Held assets (step 1) — only what the user has on Magi ────────────────
	// Withdrawing is bounded by your balance, so step 1 shows held assets only,
	// each with its live amount. Deposit shows everything; withdraw does not.
	const ASSET_DEFS = [
		{ value: Coin.hive.value, coin: Coin.hive, label: 'HIVE', icon: '/hive/hive.svg' },
		{ value: Coin.hbd.value, coin: Coin.hbd, label: 'HBD', icon: '/hive/hbd.svg' },
		{ value: Coin.btc.value, coin: Coin.btc, label: 'BTC', icon: '/btc/btc.svg' }
	];
	const heldAssets = $derived(
		ASSET_DEFS.map((a) => ({
			...a,
			balance: getBalanceAmount($accountBalance, a.coin, Network.magi)
		})).filter((a) => a.balance.amount > 0)
	);

	// ─── Destinations (step 2) — filtered by the chosen asset ─────────────────
	type DestDef = {
		value: WithdrawDestination;
		label: string;
		icon: string;
		eta: string;
		fee: string;
		blurb: string;
		supports: string[];
		disabled?: boolean;
	};
	const DESTINATIONS: DestDef[] = [
		{
			value: 'hive_mainnet',
			label: 'Hive mainnet',
			icon: '/hive/hive.svg',
			eta: 'instant',
			fee: 'no fee',
			blurb: 'Send to any Hive account on the Hive blockchain.',
			supports: [Coin.hive.value, Coin.hbd.value]
		},
		{
			value: 'btc_mainnet',
			label: 'Bitcoin mainnet',
			icon: '/btc/btc.svg',
			eta: '≈ 10 min',
			fee: 'network fee varies',
			blurb: 'Send BTC to an on-chain Bitcoin address.',
			supports: [Coin.btc.value]
		},
		{
			value: 'lightning',
			label: 'Lightning',
			icon: '/btc/lightning.svg',
			eta: '≈ 1 min',
			fee: '~10 sats',
			blurb: 'Withdraw sats to your Keepsats balance on V4VApp.',
			supports: [Coin.btc.value]
		},
		{
			value: 'coinbase',
			label: 'Coinbase',
			icon: '/btc/CoinBase_logo.svg',
			eta: '—',
			fee: 'coming soon',
			blurb: 'Cash out straight to your Coinbase account.',
			supports: [Coin.btc.value],
			disabled: true
		}
	];

	let selectedAsset = $state<string | null>(null);
	let selectedDest = $state<WithdrawDestination | null>(null);
	let secondaryMenu = $state(false);

	const availableDestinations = $derived(
		selectedAsset ? DESTINATIONS.filter((d) => d.supports.includes(selectedAsset!)) : []
	);

	// Drive the step indicator from selections.
	$effect(() => {
		if (selectedAsset && !selectedDest) stepsApi.setStep(1);
		else if (selectedAsset && selectedDest) stepsApi.setStep(2);
		else stepsApi.setStep(0);
	});

	function pickAsset(value: string) {
		selectedAsset = value;
		const def = ASSET_DEFS.find((a) => a.value === value);
		// Source is always Magi for a withdrawal — express it before dest init.
		untrack(() => {
			if (def) txState.from = { coin: def.coin, network: Network.magi };
		});
		// Invalidate a destination the new asset doesn't support.
		if (
			selectedDest &&
			!DESTINATIONS.find((d) => d.value === selectedDest)?.supports.includes(value)
		) {
			selectedDest = null;
			editStage(false);
		}
		if (selectedDest && def) {
			untrack(() => initWithdrawStateForDestination(txState, selectedDest!, def.coin));
		}
	}

	function pickDest(value: WithdrawDestination) {
		const def = DESTINATIONS.find((d) => d.value === value);
		if (def?.disabled) return;
		selectedDest = value;
		editStage(false);
		const asset = ASSET_DEFS.find((a) => a.value === selectedAsset);
		if (asset) untrack(() => initWithdrawStateForDestination(txState, value, asset.coin));
	}

	// Parent NavButtons (Review) show once a real destination is chosen — every
	// withdraw rail completes via editStage → the parent's Review button.
	$effect(() => {
		onHomePage = !!selectedDest && selectedDest !== 'coinbase';
		customButtons = undefined;
	});
</script>

<div class="page" class:bare={secondaryMenu}>
	<div class="main">
		{#if !secondaryMenu}
			<header class="page-head">
				<h2>Withdraw</h2>
				<p class="lead">Send funds from your Magi balance.</p>
			</header>
		{/if}

		<div {...stepsApi.getRootProps()} class="timeline">
			<!-- ─── Step 1: Asset (held only) ──────────────────────────────── -->
			{#if !secondaryMenu}
				<div {...stepsApi.getItemProps({ index: 0 })} class="timeline-item">
					<div {...stepsApi.getIndicatorProps({ index: 0 })} class="timeline-indicator">
						{#if stepsApi.value > 0}<Check size={14} strokeWidth={3} />{:else}1{/if}
					</div>
					<div class="timeline-content">
						<h4 class="step-heading">{stepDefs[0].label}</h4>
						<div class="step-body">
							{#if heldAssets.length === 0}
								<p class="picker-empty">You have no withdrawable balance on Magi yet.</p>
							{:else}
								<div class="chip-row">
									{#each heldAssets as a (a.value)}
										<button
											type="button"
											class="asset-chip"
											class:sel={selectedAsset === a.value}
											onclick={() => pickAsset(a.value)}
										>
											<img src={a.icon} alt="" width="22" height="22" />
											<span class="chip-text">
												<span class="chip-tk">{a.label}</span>
												<span class="chip-bal">{a.balance.toPrettyAmountString()}</span>
											</span>
										</button>
									{/each}
								</div>
								<p class="held-note">Only assets you hold on Magi are shown.</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- ─── Step 2: Destination ────────────────────────────────── -->
				<div {...stepsApi.getItemProps({ index: 1 })} class="timeline-item">
					<div {...stepsApi.getIndicatorProps({ index: 1 })} class="timeline-indicator">
						{#if stepsApi.value > 1}<Check size={14} strokeWidth={3} />{:else}2{/if}
					</div>
					<div class="timeline-content">
						<h4 class="step-heading">{stepDefs[1].label}</h4>
						<div class="step-body dest-picker">
							{#if availableDestinations.length === 0}
								<p class="picker-empty">Pick an asset first.</p>
							{:else}
								{#each availableDestinations as d (d.value)}
									<button
										type="button"
										class="dest-card"
										class:sel={selectedDest === d.value}
										class:off={d.disabled}
										disabled={d.disabled}
										onclick={() => pickDest(d.value)}
									>
										<div class="dest-icon">
											<img src={d.icon} alt={d.label} width="28" height="28" />
										</div>
										<div class="dest-body">
											<div class="dest-head">
												<span class="dest-label">{d.label}</span>
												{#if d.disabled}
													<span class="dest-soon">soon</span>
												{:else}
													<span
														class="dest-info"
														tabindex="0"
														role="button"
														aria-label="Show {d.label} details"
													>
														<Info size={14} />
														<Tooltip>
															<span class="info-tooltip">
																<span class="info-row"
																	><Clock size={12} strokeWidth={2.25} /><span>{d.eta}</span></span
																>
																<span class="info-row"
																	><Receipt size={12} strokeWidth={2.25} /><span>{d.fee}</span
																	></span
																>
															</span>
														</Tooltip>
													</span>
												{/if}
											</div>
											<p class="dest-blurb">{d.blurb}</p>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- ─── Step 3: Send ───────────────────────────────────────────── -->
			<div
				{...stepsApi.getItemProps({ index: 2 })}
				class="timeline-item"
				class:bare={secondaryMenu}
			>
				{#if !secondaryMenu}
					<div {...stepsApi.getIndicatorProps({ index: 2 })} class="timeline-indicator">
						{#if stepsApi.value > 2}<Check size={14} strokeWidth={3} />{:else}3{/if}
					</div>
				{/if}
				<div class="timeline-content">
					{#if !secondaryMenu}<h4 class="step-heading">{stepDefs[2].label}</h4>{/if}
					<div class="step-body">
						{#if selectedDest === 'hive_mainnet'}
							<HiveMainnetWithdraw {editStage} open={true} bind:secondaryMenu lockAsset={true} />
						{:else if selectedDest === 'btc_mainnet'}
							<BitcoinMainnetWithdraw {editStage} open={true} />
						{:else if selectedDest === 'lightning'}
							<KeepsatsWithdraw {editStage} open={true} />
						{:else}
							<p class="locked-hint">Select a destination above to continue.</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	$accent: #6f6af8;
	$accent-soft: rgba(111, 106, 248, 0.16);
	$border: rgba(255, 255, 255, 0.09);
	$border-strong: rgba(255, 255, 255, 0.16);
	$surface: rgba(255, 255, 255, 0.035);

	.page {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0.75rem;
	}
	.page.bare {
		padding: 0;
	}
	.page-head {
		margin-bottom: 2rem;
	}
	.page-head h2 {
		margin: 0 0 0.25rem;
		font-size: 1.85rem;
	}
	.lead {
		color: var(--dash-text-secondary);
		margin: 0;
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.timeline-item {
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		gap: 1rem;
		position: relative;
	}
	.timeline-item.bare {
		grid-template-columns: 1fr;
	}
	.timeline-item:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 2.5rem;
		left: 1.2rem;
		bottom: -1.25rem;
		width: 1px;
		background: linear-gradient(to bottom, $border, transparent);
	}
	.timeline-indicator {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 1px solid $border;
		display: flex;
		align-items: center;
		justify-content: center;
		background: $surface;
		font-weight: 600;
		color: var(--dash-text-secondary);
		font-size: 0.9rem;
		transition: all 200ms ease;
	}
	.timeline-indicator[data-state='current'] {
		border-color: $accent;
		background: $accent-soft;
		color: #fff;
		box-shadow: 0 0 0 4px rgba(111, 106, 248, 0.08);
	}
	.timeline-indicator[data-state='complete'] {
		border-color: $accent;
		background: $accent;
		color: #fff;
	}
	.timeline-content {
		min-width: 0;
	}
	.step-heading {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.step-body {
		margin-top: 0.4rem;
	}

	/* Step 1 — asset chips with balance */
	.chip-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.asset-chip {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem 0.75rem;
		border-radius: 14px;
		border: 1px solid $border;
		background: $surface;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.asset-chip:hover {
		border-color: $border-strong;
	}
	.asset-chip.sel {
		border-color: $accent;
		background: $accent-soft;
	}
	.chip-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		text-align: left;
	}
	.chip-tk {
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--dash-text-primary);
	}
	.chip-bal {
		font-size: 0.72rem;
		color: var(--dash-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.held-note {
		margin: 0.6rem 0 0;
		font-size: 0.72rem;
		color: var(--dash-text-muted);
	}

	/* Step 2 — destination cards */
	.dest-picker {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.dest-card {
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		gap: 0.85rem;
		align-items: start;
		width: 100%;
		text-align: left;
		padding: 1.1rem 1.25rem;
		border-radius: 14px;
		border: 1px solid $border;
		background: $surface;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.dest-card:hover:not(.off) {
		background: rgba(255, 255, 255, 0.05);
		border-color: $border-strong;
	}
	.dest-card.sel {
		border-color: $accent;
		background: $accent-soft;
	}
	.dest-card.off {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.dest-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
	}
	.dest-icon img {
		display: block;
		object-fit: contain;
	}
	.dest-head {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		align-items: baseline;
		min-width: 0;
	}
	.dest-label {
		font-weight: 600;
		font-size: 0.95rem;
	}
	.dest-soon {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dash-text-muted);
		border: 1px solid $border-strong;
		border-radius: 1rem;
		padding: 0.05rem 0.45rem;
	}
	.dest-info {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--dash-text-secondary);
		cursor: default;
		flex-shrink: 0;
		outline: none;
	}
	.dest-info:hover,
	.dest-info:focus-visible {
		color: var(--dash-text-primary);
	}
	.dest-info:hover :global(.tooltip),
	.dest-info:focus-visible :global(.tooltip) {
		opacity: 1;
		visibility: visible;
	}
	.info-tooltip {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-start;
		white-space: normal;
	}
	.info-row {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		font-weight: 500;
		white-space: nowrap;
	}
	.dest-blurb {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
		line-height: 1.4;
	}

	.locked-hint {
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
	}
	.picker-empty {
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
		padding: 0.5rem 0;
	}
</style>
