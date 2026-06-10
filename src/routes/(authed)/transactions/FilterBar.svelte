<!--
	Filter controls for the transactions table — two surfaces:

	1. QUICK FILTERS: token + time-range chips rendered inline (hidden on
	   narrow screens via media query) so the most common filters are one
	   click away without opening anything.
	2. FULL PANEL: a "Filters" button (rendered top-right by the parent's
	   header row) opening the project's SidePopup — the same right-slide
	   panel used for transaction details — holding all five filter
	   groups with room to breathe.

	State is owned by the parent (+page.svelte) via the bindable `filters`
	prop. Filtering itself happens elsewhere (filters.ts / Table.svelte).
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { portal } from '@zag-js/svelte';
	import { ListFilter, X } from '@lucide/svelte';
	import {
		EMPTY_FILTERS,
		TIME_RANGE_OPTIONS,
		TOKEN_OPTIONS,
		TYPE_OPTIONS,
		activeFilterCount,
		type TxFilters
	} from './filters';

	let { filters = $bindable() }: { filters: TxFilters } = $props();

	const activeCount = $derived(activeFilterCount(filters));

	let panelOpen = $state(false);
	function togglePanel() {
		// Commit any half-typed text before the panel goes away — closing
		// the drawer must never silently drop input.
		if (panelOpen) commitTexts();
		panelOpen = !panelOpen;
	}

	// Local text state for the free-text inputs. Applied LIVE with a
	// 300ms debounce — the client filter is a pure function over the
	// loaded rows (sub-ms), and the only expensive path (server refetch
	// for full account ids) fires once after typing stops, not per
	// keystroke. Enter applies immediately.
	let amountMinText = $state('');
	let amountMaxText = $state('');
	let addressText = $state('');

	let debounceHandle: ReturnType<typeof setTimeout> | undefined;
	function debounceCommit() {
		clearTimeout(debounceHandle);
		debounceHandle = setTimeout(commitTexts, 300);
	}
	// Unmount cleanup — a pending debounce would otherwise fire commitTexts
	// against destroyed state if the user navigates away mid-typing.
	$effect(() => () => clearTimeout(debounceHandle));

	function commitTexts() {
		clearTimeout(debounceHandle);
		const min = parseFloat(amountMinText.replace(',', '.'));
		const max = parseFloat(amountMaxText.replace(',', '.'));
		filters.amountMin = Number.isFinite(min) && min > 0 ? min : null;
		filters.amountMax = Number.isFinite(max) && max > 0 ? max : null;
		filters.address = addressText.trim();
	}

	function toggleToken(value: string) {
		filters.tokens = filters.tokens.includes(value)
			? filters.tokens.filter((t) => t !== value)
			: [...filters.tokens, value];
	}

	function toggleType(value: string) {
		filters.types = filters.types.includes(value)
			? filters.types.filter((t) => t !== value)
			: [...filters.types, value];
	}

	function clearAll() {
		filters = { ...EMPTY_FILTERS };
		amountMinText = '';
		amountMaxText = '';
		addressText = '';
	}

	const amountChipLabel = $derived.by(() => {
		const { amountMin: min, amountMax: max } = filters;
		if (min != null && max != null) return `${min} – ${max}`;
		if (min != null) return `≥ ${min}`;
		if (max != null) return `≤ ${max}`;
		return '';
	});

	/** Any filter set from the PANEL (not the quick chips) is active —
	 *  drives the pipe divider before the dynamic summary chips. */
	const hasPanelChips = $derived(
		amountChipLabel !== '' || filters.types.length > 0 || filters.address.trim() !== ''
	);
</script>

<!-- One row: permanent quick chips │ dynamic summary chips … [Filters].
     The trigger sits at the right END of the chips row (margin-left auto),
     not up on the title line. -->
<div class="quick-filters">
	<div class="quick-group">
		{#each TOKEN_OPTIONS as opt (opt.value)}
			<button
				class="chip"
				class:on={filters.tokens.includes(opt.value)}
				onclick={() => toggleToken(opt.value)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
	<div class="quick-sep"></div>
	<div class="quick-group">
		{#each TIME_RANGE_OPTIONS as opt (opt.value)}
			<button
				class="chip"
				class:on={filters.timeRange === opt.value}
				onclick={() => (filters.timeRange = opt.value)}
			>
				{opt.label}
			</button>
		{/each}
	</div>

	<!-- Pipe divider: separates the ALWAYS-PRESENT quick chips from the
	     dynamic summary chips that appear/disappear as panel filters
	     toggle. Rendered only when at least one panel filter is active. -->
	{#if hasPanelChips}
		<div class="quick-sep"></div>
	{/if}

	<!-- Summary chips, grouped by category with a pipe BETWEEN categories
	     (amount │ types │ address) — chips of the same category sit
	     together; the pipes mark the category boundaries. -->
	{#if amountChipLabel}
		<span class="summary-chip">
			{amountChipLabel}
			<button
				aria-label="Clear amount filter"
				onclick={() => {
					filters.amountMin = null;
					filters.amountMax = null;
					amountMinText = '';
					amountMaxText = '';
				}}><X size={12} /></button
			>
		</span>
	{/if}
	{#if amountChipLabel && filters.types.length > 0}
		<div class="quick-sep"></div>
	{/if}
	<!-- One chip per selected type, each individually clearable — removing
	     "transfer" shouldn't also clear "deposit". -->
	{#each filters.types as t (t)}
		<span class="summary-chip">
			{TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t}
			<button aria-label="Remove {t} filter" onclick={() => toggleType(t)}><X size={12} /></button>
		</span>
	{/each}
	{#if filters.address.trim() !== '' && (amountChipLabel !== '' || filters.types.length > 0)}
		<div class="quick-sep"></div>
	{/if}
	{#if filters.address.trim() !== ''}
		<span class="summary-chip">
			{filters.address}
			<button
				aria-label="Clear address filter"
				onclick={() => {
					filters.address = '';
					addressText = '';
				}}><X size={12} /></button
			>
		</span>
	{/if}

	<button class="filter-trigger" class:active={activeCount > 0} onclick={togglePanel}>
		<ListFilter size={15} />
		<span>Filters{activeCount > 0 ? ` (${activeCount})` : ''}</span>
	</button>
</div>

<!-- ── Right-edge drawer ──
     A fixed full-height panel sliding in from the right edge of the
     screen (~26rem wide, capped at 90vw on phones). Backdrop click and
     ESC both slide it back out. Local to this component on purpose —
     the shared SidePopup is a centered modal used by tx details and
     restyling it would change that surface too. -->
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && panelOpen) togglePanel();
	}}
/>

{#if panelOpen}
	<!-- use:portal teleports both nodes to document.body — same trick
	     SidePopup uses. Without it, any ancestor with a transform /
	     backdrop-filter becomes the containing block for position:fixed
	     and the drawer renders trapped inside the page card instead of
	     spanning the full viewport. -->
	<div
		use:portal
		class="drawer-backdrop"
		transition:fade={{ duration: 180 }}
		onclick={togglePanel}
		role="presentation"
	></div>
	<div
		use:portal
		class="drawer"
		transition:fly={{ x: 420, duration: 260, opacity: 1 }}
		role="dialog"
		aria-modal="true"
		aria-label="Filter transactions"
	>
		<div class="drawer-header">
			<h3>Filters</h3>
			<button class="drawer-close" aria-label="Close filters" onclick={togglePanel}>
				<X size={20} />
			</button>
		</div>
		{@render panelContent()}
	</div>
{/if}

{#snippet panelContent()}
	<div class="filter-panel">
		<section>
			<h4>Tokens</h4>
			<div class="chip-group">
				{#each TOKEN_OPTIONS as opt (opt.value)}
					<button
						class="chip large"
						class:on={filters.tokens.includes(opt.value)}
						onclick={() => toggleToken(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h4>Time range</h4>
			<div class="chip-group">
				{#each TIME_RANGE_OPTIONS as opt (opt.value)}
					<button
						class="chip large"
						class:on={filters.timeRange === opt.value}
						onclick={() => (filters.timeRange = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h4>Amount</h4>
			<div class="amount-row">
				<input
					type="text"
					inputmode="decimal"
					placeholder="Min"
					bind:value={amountMinText}
					oninput={debounceCommit}
				/>
				<span class="amount-sep">–</span>
				<input
					type="text"
					inputmode="decimal"
					placeholder="Max"
					bind:value={amountMaxText}
					oninput={debounceCommit}
				/>
			</div>
			<p class="hint">In the asset&rsquo;s own units — e.g. 10 matches 10 HIVE or 10 BTC</p>
		</section>

		<section>
			<h4>Type</h4>
			<div class="chip-group">
				{#each TYPE_OPTIONS as opt (opt.value)}
					<button
						class="chip large"
						class:on={filters.types.includes(opt.value)}
						onclick={() => toggleType(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h4>Address / user</h4>
			<input
				class="address-input"
				type="text"
				placeholder="hive:username, 0x…, bc1…"
				bind:value={addressText}
				oninput={debounceCommit}
				onkeydown={(e) => {
					if (e.key === 'Enter') commitTexts();
				}}
			/>
			<p class="hint">Matches either side of a transfer, partial text is fine</p>
		</section>

		<div class="panel-footer">
			<button class="clear-all" onclick={clearAll} disabled={activeCount === 0}> Clear all </button>
			<button class="apply" onclick={togglePanel}>Done</button>
		</div>
	</div>
{/snippet}

<style lang="scss">
	/* ── Trigger ── */
	.filter-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--dash-card-border);
		background: rgba(255, 255, 255, 0.04);
		color: var(--dash-text-primary);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.filter-trigger:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.filter-trigger.active {
		border-color: var(--dash-accent-purple, #6f6af8);
		color: var(--dash-accent-purple, #6f6af8);
		background: rgba(111, 106, 248, 0.08);
	}

	/* ── Quick filters row ── */
	.quick-filters {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin: 0.25rem 0 1rem;
	}
	/* Trigger sits at the right end of the chips row. */
	.quick-filters > .filter-trigger {
		margin-left: auto;
	}
	.quick-sep {
		width: 1px;
		height: 1.25rem;
		background: var(--dash-card-border);
		margin: 0 0.35rem;
	}
	.quick-group {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	/* On narrow screens the quick chips take too much vertical space —
	   the side panel covers everything, so hide them and keep just the
	   summary chips (which only render when something is active). */
	@media (max-width: 900px) {
		.quick-group,
		.quick-sep {
			display: none;
		}
	}

	/* ── Chips (shared) ── */
	.chip {
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		border: 1px solid var(--dash-card-border);
		background: rgba(255, 255, 255, 0.03);
		color: var(--dash-text-secondary);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: all 130ms ease;
	}
	.chip:hover {
		border-color: rgba(255, 255, 255, 0.28);
		color: var(--dash-text-primary);
	}
	.chip.on {
		border-color: var(--dash-accent-purple, #6f6af8);
		background: rgba(111, 106, 248, 0.18);
		color: var(--dash-text-primary);
	}
	.chip.large {
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
	}

	/* ── Summary chips (active filters set from the panel) ── */
	.summary-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.4rem 0.25rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--dash-accent-purple, #6f6af8);
		background: rgba(111, 106, 248, 0.12);
		color: var(--dash-text-primary);
		font-size: 0.75rem;
		max-width: 14rem;
		overflow: hidden;
	}
	.summary-chip button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0.1rem;
		color: var(--dash-text-secondary);
		cursor: pointer;
		border-radius: 50%;
	}
	.summary-chip button:hover {
		color: var(--dash-text-primary);
		background: rgba(255, 255, 255, 0.1);
	}

	/* ── Drawer shell ── */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 40;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(26rem, 90vw);
		box-sizing: border-box;
		z-index: 41;
		display: flex;
		flex-direction: column;
		background: linear-gradient(135deg, #20202a 0%, #13131a 100%);
		border-left: 1px solid var(--dash-card-border);
		box-shadow: -12px 0 40px rgba(0, 0, 0, 0.45);
		padding: 1.25rem 1.5rem;
		overflow-y: auto;
	}
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}
	.drawer-header h3 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	.drawer-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0.35rem;
		border-radius: 8px;
		color: var(--dash-text-secondary);
		cursor: pointer;
		transition:
			background-color 130ms ease,
			color 130ms ease;
	}
	.drawer-close:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--dash-text-primary);
	}

	/* ── Drawer content ── */
	.filter-panel {
		display: flex;
		flex-direction: column;
		/* Generous breathing room between filter groups — they read as
		   distinct sections rather than one stacked blob. */
		gap: 2.5rem;
		padding-top: 0.5rem;
	}
	.filter-panel section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.filter-panel h4 {
		margin: 0;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--dash-text-secondary);
		font-weight: 600;
	}
	.chip-group {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.amount-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	/* Compact: fixed narrow width instead of flex-filling half the drawer
	   each. Explicit height (not padding-derived) so the boxes are
	   pixel-identical to the address input regardless of UA defaults. */
	.amount-row input {
		width: 6.5rem;
		height: 2.25rem;
		box-sizing: border-box;
		flex: none;
		font: inherit;
		font-size: 0.85rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--dash-card-border);
		color: var(--dash-text-primary);
		border-radius: 10px;
		padding: 0 0.65rem;
		transition: border-color 150ms ease;
	}
	.amount-row input:focus {
		outline: none;
		border-color: var(--dash-accent-purple, #6f6af8);
	}
	.amount-sep {
		color: var(--dash-text-muted);
		flex-shrink: 0;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: var(--dash-text-muted);
	}

	.address-input {
		width: 100%;
		height: 2.25rem;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.85rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--dash-card-border);
		color: var(--dash-text-primary);
		border-radius: 10px;
		padding: 0 0.65rem;
		transition: border-color 150ms ease;
	}
	.address-input:focus {
		outline: none;
		border-color: var(--dash-accent-purple, #6f6af8);
	}

	/* ── Panel footer ── */
	.panel-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.clear-all {
		background: none;
		border: none;
		padding: 0.4rem 0;
		font: inherit;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
		text-decoration: underline;
		cursor: pointer;
	}
	.clear-all:hover:not(:disabled) {
		color: var(--dash-text-primary);
	}
	.clear-all:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.apply {
		background: var(--dash-accent-purple, #6f6af8);
		border: none;
		color: #fff;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.55rem 1.5rem;
		border-radius: 999px;
		cursor: pointer;
		transition: background-color 150ms ease;
	}
	.apply:hover {
		background: #807cff;
	}
</style>
