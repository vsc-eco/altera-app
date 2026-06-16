<!--
	Deposit flow — production timeline.

	Adopts the design from DepositFlowMock.svelte (the 3-step Asset → Source →
	Send timeline) and wires its internals to the SAME real txState/broadcast
	plumbing the legacy DepositOptions / DepositFlow used.

	The visuals (markup + <style>) are carried over verbatim from the mock.
	The differences are all under the hood:
	  • step 1/2 selections route through useDepositState() +
	    initDepositStateForSource() (payload-equivalence pinned by
	    depositInit.test.ts), instead of holding inert local state
	  • step 3 mounts the REAL per-source components (HiveMainnetDeposit,
	    LightningDeposit, BitcoinMainnetDeposit, CoinBaseDeposit) instead of
	    the mock's fake amount input / fake address / QR placeholder
	  • the parent contract (editStage, onHomePage, customButtons, onClose,
	    onBroadcast) matches DepositFlow so DepositPage's StepsMachine wiring
	    is a one-line swap

	The recent-deposits rail and FAQ accordion live in a separate page-level
	column (DepositSidebar.svelte) — this component is the flow only.
-->
<script lang="ts">
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getAuth } from '$lib/auth/store';
	import { untrack, type ComponentProps } from 'svelte';
	import { Check, Clock, Info, Receipt, Search } from '@lucide/svelte';

	// ─── Real deposit wiring ─────────────────────────────────────────────────
	import { Coin, Network } from '../../utils/sendOptions';
	import { useDepositState } from '../../utils/txState.svelte';
	import { initDepositStateForSource, type DepositSource } from './depositInit';
	import HiveMainnetDeposit from './HiveMainnetDeposit.svelte';
	import LightningDeposit from './LightningDeposit.svelte';
	import BtcMainnetDeposit from './BitcoinMainnetDeposit.svelte';
	import CoinBaseDeposit from './CoinBaseDeposit.svelte';
	import type { NavButton } from '$lib/sendswap/components/NavButtons.svelte';
	import type NavButtons from '$lib/sendswap/components/NavButtons.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';

	// Props contract matches DepositFlow.svelte so the StepsMachine wiring is
	// a one-line swap. onHomePage / customButtons MUST stay $bindable — the
	// StepsMachine binds them to drive the "Review Deposit" / Coinbase
	// "Deposit" footer buttons.
	let {
		editStage,
		onHomePage = $bindable(),
		customButtons = $bindable(),
		onClose,
		onBroadcast
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
		customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined;
		onClose?: () => void;
		onBroadcast?: (info: {
			txHash: string;
			amount: CoinAmount<typeof Coin.btc>;
			address: string;
		}) => void;
	} = $props();

	const txState = useDepositState();
	const auth = $derived(getAuth()());

	// ─── Step machine (Zag) — drives the timeline indicators ─────────────────
	// Mental model for the wording:
	//   step 1 = the asset the user WANTS on Magi (destination)
	//   step 2 = where the funds physically come FROM (network / rail)
	//   step 3 = sign-and-send details
	const stepDefs = [
		{ id: 'asset', label: 'I want to receive' },
		{ id: 'source', label: 'From' },
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

	// ─── State ────────────────────────────────────────────────────────────────
	// selectedAsset / selectedSource still drive the timeline visuals, but
	// every change ALSO flows into txState via pickAsset / pickSource exactly
	// as DepositFlow does (so the broadcast payload is identical).
	let selectedAsset = $state<string | null>(null);
	let selectedSource = $state<DepositSource | null>(null);

	// Drive the step indicator state from selections.
	$effect(() => {
		if (selectedAsset && !selectedSource) stepsApi.setStep(1);
		else if (selectedAsset && selectedSource) stepsApi.setStep(2);
		else stepsApi.setStep(0);
	});

	// Steps 2 and 3 are ALWAYS expanded — no collapse/expand. The whole flow
	// stays visible so nothing jumps or hides as the user moves through it.

	// ─── Asset chips (RadioGroup + icons) ─────────────────────────────────────
	// Top-level assets the user can deposit. SATS is intentionally NOT here
	// — it's just sub-units of BTC, not a separate asset; the BTC card
	// covers it via the source components inside step 3.
	const ASSETS = [
		{ value: Coin.hive.value, label: 'HIVE', icon: '/hive/hive.svg', disabled: false },
		{ value: Coin.hbd.value, label: 'HBD', icon: '/hive/hbd.svg', disabled: false },
		{ value: Coin.btc.value, label: 'BTC', icon: '/btc/btc.svg', disabled: false },
		{ value: 'eth', label: 'ETH', icon: '/eth/eth.svg', disabled: true }
	];
	type AssetValue = (typeof ASSETS)[number]['value'];

	// ─── Source picker (RadioGroup with snippets per option) ──────────────────
	// `supports` lists the assets this source can deliver DIRECTLY. This is
	// the CONFIRMED/wired support matrix (HIVE → hive_mainnet, lightning;
	// HBD → hive_mainnet, lightning; BTC → lightning, btc_mainnet, coinbase).
	// Step 2 shows ONLY sources whose `supports` includes the chosen asset.
	type SourceDef = {
		value: DepositSource;
		label: string;
		icon: string;
		eta: string;
		fee: string;
		blurb: string;
		supports: AssetValue[];
	};
	const SOURCES: SourceDef[] = [
		{
			value: 'hive_mainnet',
			label: 'Hive Mainnet',
			icon: '/hive/hive.svg',
			eta: 'instant',
			fee: 'no fee',
			blurb: 'Send from your connected Hive wallet (Keychain, PeakVault, …).',
			supports: [Coin.hive.value, Coin.hbd.value]
		},
		{
			value: 'lightning',
			label: 'Lightning',
			icon: '/btc/lightning.svg',
			eta: '≈ 1 min',
			fee: '~10 sats',
			blurb: 'Scan an invoice with any Lightning wallet (Phoenix, Alby, …).',
			supports: [Coin.hive.value, Coin.hbd.value, Coin.btc.value]
		},
		{
			value: 'btc_mainnet',
			label: 'Bitcoin Mainnet',
			icon: '/btc/btc.svg',
			eta: '≈ 10 min',
			fee: 'network fee varies',
			blurb: 'Send BTC to a bridge-managed deposit address. Settles after 1 confirmation.',
			supports: [Coin.btc.value]
		},
		{
			value: 'coinbase',
			label: 'Coinbase',
			icon: '/btc/CoinBase_logo.svg',
			eta: '≈ 15 min',
			fee: 'Coinbase rates apply',
			blurb: 'Buy with card and have it deposited to Magi in one step.',
			supports: [Coin.btc.value]
		}
	];

	// Sources that can deliver the chosen asset directly. Step 2 shows only
	// these (DepositFlow's availableSources filtering pattern).
	const availableSources = $derived.by(() => {
		const asset = selectedAsset;
		return asset ? SOURCES.filter((s) => s.supports.includes(asset)) : [];
	});

	// True when the chosen source delivers a DIFFERENT asset than the one
	// the user picked in step 1. With the filtered availableSources every
	// shown card is direct, so this is always false for visible cards — kept
	// so the mock's via-swap markup carries over unchanged.
	function isViaSwap(source: SourceDef | undefined, asset: AssetValue | null): boolean {
		if (!source || !asset) return false;
		return !source.supports.includes(asset);
	}

	const selectedAssetDef = $derived(ASSETS.find((a) => a.value === selectedAsset));

	function pickAsset(value: string) {
		selectedAsset = value;
		// Express the user's receive intent in txState BEFORE source init —
		// the shared init functions read txState.to.
		untrack(() => {
			const coin = Object.values(Coin).find((c) => c.value === value);
			if (coin) txState.to = { coin, network: Network.magi };
		});
		// Invalidate an incompatible previously-picked source.
		if (
			selectedSource &&
			!SOURCES.find((s) => s.value === selectedSource)?.supports.includes(value)
		) {
			selectedSource = null;
			editStage(false);
		}
		// Re-run init if a compatible source is already selected (asset
		// change must flow into from/to like the legacy re-open did).
		if (selectedSource) {
			untrack(() => initDepositStateForSource(txState, selectedSource!));
		}
	}

	function pickSource(value: DepositSource) {
		selectedSource = value;
		editStage(false);
		untrack(() => initDepositStateForSource(txState, value));
	}

	// RadioGroup binds string values; route them through pickAsset /
	// pickSource (the bound vars themselves are written inside those).
	let assetRadio = $state<string | null>(null);
	$effect(() => {
		if (assetRadio && assetRadio !== selectedAsset) {
			const a = ASSETS.find((x) => x.value === assetRadio);
			if (a && !a.disabled) untrack(() => pickAsset(assetRadio!));
		}
	});
	let sourceRadio = $state<string | null>(null);
	$effect(() => {
		if (sourceRadio && sourceRadio !== selectedSource) {
			untrack(() => pickSource(sourceRadio as DepositSource));
		}
	});

	// ─── Legacy parity for the parent contract ───────────────────────────
	// onHomePage drives the parent's NavButtons (Review) visibility — same
	// condition DepositFlow / the legacy DepositOptions used.
	$effect(() => {
		onHomePage =
			selectedSource === 'lightning' ||
			(selectedSource === 'hive_mainnet' && auth.value?.provider === 'aioha') ||
			selectedSource === 'coinbase';
	});

	// Coinbase exports its Deposit button into the parent's footer.
	let customButton: NavButton = $state({ label: '', action: () => {} });
	$effect(() => {
		if (selectedSource === 'coinbase' && customButton) {
			customButtons = { fwd: customButton };
		} else {
			customButtons = undefined;
		}
	});

	// Child asset-picker overlay state (Lightning/HiveMainnet own pickers).
	// When true, hide the timeline chrome so the sub-picker owns the
	// surface (same as DepositFlow's class:bare / hidden-header behavior).
	let secondaryMenu = $state(false);
</script>

<!-- Asset chip snippets — one per asset (per HiveLogin pattern; RadioGroup's
     Item generic is self-referential and rejects a shared snippet). -->
{#snippet hiveChip()}{@render assetChipLayout(ASSETS[0])}{/snippet}
{#snippet hbdChip()}{@render assetChipLayout(ASSETS[1])}{/snippet}
{#snippet btcChip()}{@render assetChipLayout(ASSETS[2])}{/snippet}
{#snippet ethChip()}{@render assetChipLayout(ASSETS[3])}{/snippet}

{#snippet assetChipLayout(a: (typeof ASSETS)[number])}
	<span class="asset-chip">
		<img src={a.icon} alt="" width="18" height="18" />
		<span>{a.label}</span>
	</span>
{/snippet}

<!-- Source card snippets — one per source (same reason). -->
{#snippet hiveMainnetCard()}{@render sourceCardLayout(SOURCES[0])}{/snippet}
{#snippet lightningCard()}{@render sourceCardLayout(SOURCES[1])}{/snippet}
{#snippet btcMainnetCard()}{@render sourceCardLayout(SOURCES[2])}{/snippet}
{#snippet coinbaseCard()}{@render sourceCardLayout(SOURCES[3])}{/snippet}

{#snippet sourceCardLayout(def: (typeof SOURCES)[number])}
	{@const viaSwap = isViaSwap(def, selectedAsset as AssetValue | null)}
	<div class="source-card" class:via-swap={viaSwap}>
		<!--
			Badge sits absolute on the card's top edge, centered. Position is
			fixed across every card (top: -0.6rem, left: 50%) so a column of
			cards stacked vertically all show their badges in the same spot.
		-->
		{#if viaSwap}
			<span class="via-swap-badge" tabindex="0" role="button" aria-label="What does via swap mean?">
				via swap
				<Tooltip>
					Includes an on-chain swap to {selectedAssetDef?.label ?? selectedAsset}
				</Tooltip>
			</span>
		{/if}
		<!--
			Real SVG icons from /static, matching the production DepositOptions
			flow.
		-->
		<div class="source-icon">
			<img src={def.icon} alt={def.label} width="28" height="28" />
		</div>
		<div class="source-body">
			<div class="source-head">
				<span class="source-label">{def.label}</span>
				<!--
					ETA + fee live in the tooltip on this Info icon. Frees the
					card head to be label-only.
				-->
				<span class="source-info" tabindex="0" role="button" aria-label="Show {def.label} details">
					<Info size={14} />
					<Tooltip>
						<span class="info-tooltip">
							<span class="info-row">
								<Clock size={12} strokeWidth={2.25} />
								<span>{def.eta}</span>
							</span>
							<span class="info-row">
								<Receipt size={12} strokeWidth={2.25} />
								<span>{def.fee}</span>
							</span>
						</span>
					</Tooltip>
				</span>
			</div>
			<p class="source-blurb">{def.blurb}</p>
		</div>
	</div>
{/snippet}

<div class="page" class:bare={secondaryMenu}>
	<div class="main">
		{#if !secondaryMenu}
			<header class="page-head">
				<h2>Deposit</h2>
				<p class="lead">Add funds to your Magi balance.</p>
			</header>
		{/if}

		<!-- Timeline (Zag steps machine drives indicator state only) -->
		<div {...stepsApi.getRootProps()} class="timeline">
			<!-- ─── Step 1: Asset ────────────────────────────────────────── -->
			{#if !secondaryMenu}
				<div {...stepsApi.getItemProps({ index: 0 })} class="timeline-item">
					<div {...stepsApi.getIndicatorProps({ index: 0 })} class="timeline-indicator">
						{#if stepsApi.value > 0}
							<Check size={14} strokeWidth={3} />
						{:else}
							1
						{/if}
					</div>
					<div class="timeline-content">
						<h4 class="step-heading">{stepDefs[0].label}</h4>
						<div class="step-body">
							<div class="chip-row">
								<RadioGroup
									items={[
										{ value: ASSETS[0].value, snippet: hiveChip },
										{ value: ASSETS[1].value, snippet: hbdChip },
										{ value: ASSETS[2].value, snippet: btcChip },
										{ value: ASSETS[3].value, snippet: ethChip, disabled: true }
									]}
									bind:value={assetRadio}
								/>
								<button
									class="other-asset-btn"
									type="button"
									disabled
									aria-label="Search for another asset"
								>
									<Search size={14} />
									<span>Other</span>
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- ─── Step 2: Source (collapsible) ─────────────────────────── -->
				<div {...stepsApi.getItemProps({ index: 1 })} class="timeline-item">
					<div {...stepsApi.getIndicatorProps({ index: 1 })} class="timeline-indicator">
						{#if stepsApi.value > 1}
							<Check size={14} strokeWidth={3} />
						{:else}
							2
						{/if}
					</div>
					<div class="timeline-content">
						<h4 class="step-heading">{stepDefs[1].label}</h4>
						<div class="step-body source-picker">
							{#if availableSources.length === 0}
								<p class="picker-empty">Pick an asset first.</p>
							{:else}
								<RadioGroup
									items={availableSources.map((s) => {
										const snippet =
											s.value === 'hive_mainnet'
												? hiveMainnetCard
												: s.value === 'lightning'
													? lightningCard
													: s.value === 'btc_mainnet'
														? btcMainnetCard
														: coinbaseCard;
										return { value: s.value, snippet };
									})}
									bind:value={sourceRadio}
								/>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- ─── Step 3: Send (collapsible) ───────────────────────────── -->
			<div
				{...stepsApi.getItemProps({ index: 2 })}
				class="timeline-item"
				class:bare={secondaryMenu}
			>
				{#if !secondaryMenu}
					<div {...stepsApi.getIndicatorProps({ index: 2 })} class="timeline-indicator">
						{#if stepsApi.value > 2}
							<Check size={14} strokeWidth={3} />
						{:else}
							3
						{/if}
					</div>
				{/if}
				<div class="timeline-content">
					{#if !secondaryMenu}
						<h4 class="step-heading">{stepDefs[2].label}</h4>
					{/if}
					<div class="step-body">
						{#if selectedSource === 'hive_mainnet'}
							<HiveMainnetDeposit {editStage} open={true} bind:secondaryMenu lockAsset={true} />
						{:else if selectedSource === 'lightning'}
							<LightningDeposit {editStage} open={true} bind:secondaryMenu lockAsset={true} />
						{:else if selectedSource === 'btc_mainnet'}
							<BtcMainnetDeposit {onClose} {onBroadcast} />
						{:else if selectedSource === 'coinbase'}
							<CoinBaseDeposit bind:customButton />
						{:else}
							<p class="locked-hint">Select a source above to continue.</p>
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
		/* Inset so the active step indicator's box-shadow glow ring (and the
		   check-mark) isn't clipped against the container edge. */
		padding: 0.5rem 0.75rem;
	}
	/* When a child source's asset sub-picker takes over, drop the page
	   padding so the sub-picker owns the full surface. */
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

	/* ─── Timeline ──────────────────────────────────────────────────────── */
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

	/* ─── Step 1: asset chips ────────────────────────────────────────────── */
	.chip-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	/* RadioGroup styles its own items; we override the inner content with .asset-chip */
	:global(.asset-chip) {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.95rem;
		line-height: 1;
	}
	:global(.asset-chip img) {
		display: block;
	}
	.other-asset-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: 1px dashed $border-strong;
		color: var(--dash-text-secondary);
		border-radius: 16px;
		height: 2.5rem;
		padding: 0 0.85rem;
		font: inherit;
		font-size: 0.9rem;
		cursor: not-allowed;
	}

	/* ─── Step 2: source cards ───────────────────────────────────────────── */
	/* RadioGroup gives each item a 20% width fallback; for full-row source
	   cards we need to override to one-per-row. Scoped via :global because
	   RadioGroup's internals are encapsulated. */
	.source-picker :global([data-scope='radio-group'][data-part='root']) :global(.items) {
		flex-direction: column;
		gap: 0.6rem;
	}
	.source-picker
		:global([data-scope='radio-group'][data-part='root'])
		:global(.items)
		> :global(*) {
		width: 100%;
		min-width: 0;
	}
	/* Give each source row real breathing room as a clickable card. */
	.source-picker :global([data-scope='radio-group'][data-part='item']) {
		padding: 1.1rem 1.25rem;
		height: auto; /* override RadioGroup's 2.5rem default — cards need to size to content */
		border-radius: 14px;
		border: 1px solid $border;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.source-picker :global([data-scope='radio-group'][data-part='item']:hover) {
		background: $surface;
		border-color: $border-strong;
	}
	.source-picker :global([data-scope='radio-group'][data-part='item'][data-state='checked']) {
		background: $accent-soft;
		border-color: $accent;
	}
	/* Re-flatten when inside the chip row (step 1) */
	.chip-row :global([data-scope='radio-group'][data-part='root']) :global(.items) {
		flex-direction: row;
		gap: 0.6rem;
	}
	/* Pin each asset chip to a content-sized fixed width and KILL flex-grow. */
	.chip-row :global([data-scope='radio-group'][data-part='root']) :global(.items) > :global(*) {
		flex: 0 0 auto;
		width: 5.25rem;
		min-width: 0;
		justify-content: center;
	}

	:global(.source-card) {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.85rem;
		align-items: start;
		width: 100%;
	}
	/* Icon-only tile — no background pill behind the SVG. */
	:global(.source-icon) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
	}
	:global(.source-icon img) {
		display: block;
		object-fit: contain;
	}
	:global(.source-head) {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		align-items: baseline;
		min-width: 0;
	}
	:global(.source-label) {
		font-weight: 600;
		font-size: 0.95rem;
	}
	/* Info icon in the source-card head. */
	:global(.source-info) {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--dash-text-secondary);
		cursor: default;
		flex-shrink: 0;
		outline: none;
	}
	:global(.source-info:hover),
	:global(.source-info:focus-visible) {
		color: var(--dash-text-primary);
	}
	:global(.source-info:hover) :global(.tooltip),
	:global(.source-info:focus-visible) :global(.tooltip) {
		opacity: 1;
		visibility: visible;
	}
	:global(.info-tooltip) {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-start;
		white-space: normal;
	}
	:global(.info-row) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		font-weight: 500;
		white-space: nowrap;
	}
	:global(.info-row svg) {
		opacity: 0.85;
		flex-shrink: 0;
	}
	:global(.source-blurb) {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
		line-height: 1.4;
	}

	/* "via swap" treatment. */
	:global(.source-card.via-swap) :global(.source-icon img) {
		filter: saturate(0.55);
		opacity: 0.75;
	}
	:global(.via-swap-badge) {
		position: absolute;
		top: 0.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: inline-flex;
		align-items: center;
		padding: 0.12rem 0.55rem;
		border-radius: 1rem;
		border: 1px solid var(--dash-accent-purple, #6f6af8);
		color: var(--dash-accent-purple, #6f6af8);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: default;
		white-space: nowrap;
		outline: none;
	}
	:global(.via-swap-badge:hover) :global(.tooltip),
	:global(.via-swap-badge:focus-visible) :global(.tooltip) {
		opacity: 1;
		visibility: visible;
	}
	:global(.via-swap-badge:focus-visible) {
		box-shadow: 0 0 0 2px rgba(111, 106, 248, 0.4);
	}

	/* ─── Step 3: send block ─────────────────────────────────────────────── */
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
