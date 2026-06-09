<!--
	Deposit flow redesign — lo-fi mock.

	Throwaway: this component is a static/clickable mock for design review.
	It mounts NO real wallet, signer, or txState — every "Continue" button
	is a console.log. The goal is to evaluate the 3-step timeline UX
	(Asset → Source → Send) before refactoring DepositOptions.svelte.

	Zag-first per project convention:
	- @zag-js/steps drives the timeline indicator state (current / complete)
	- @zag-js/collapsible drives the per-step expand/collapse for steps 2 & 3
	- RadioGroup wrapper (which wraps @zag-js/radio-group) renders the asset
	  chips and source picker
	- Collapsible wrapper (which wraps @zag-js/collapsible) renders the
	  right-rail FAQ items
	No custom-built radio buttons, dropdowns, step indicators, or
	collapsibles.

	Delete this file once the MVP lands in production code.
-->
<script lang="ts">
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Collapsible from '$lib/zag/Collapsible.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import SidePopup from '$lib/components/SidePopup.svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	import moment from 'moment';
	import type { Snippet } from 'svelte';
	// Tr.svelte and SidePopup ARE the transactions table's modal pieces —
	// we mount Tr instances hidden, dispatch a DOM click on them when the
	// user clicks our compact "recent deposit" row, and the Tr's existing
	// onRowClick handler hands us back the exact snippet the transactions
	// page uses for its SidePopup. End result: identical modal, no
	// navigation, no duplicated content.
	import Tr from '../../../routes/(authed)/transactions/Table/tr/Tr.svelte';
	import { getTimestamp, type TransactionInter } from '$lib/stores/txStores';
	import { Check, ChevronDown, Clock, Info, Receipt, Search } from '@lucide/svelte';

	// ─── Step machine (Zag) — drives the timeline indicators ─────────────────
	// Mental model for the wording:
	//   step 1 = the asset the user WANTS on Magi (destination)
	//   step 2 = where the funds physically come FROM (network / rail)
	//   step 3 = sign-and-send details
	// "Select asset" reads as "what am I sending" which is wrong when the
	// route is cross-asset (pick HIVE then Lightning would read as "deposit
	// HIVE via Lightning" — but really you're sending BTC over Lightning
	// and the bridge swaps it to HIVE). "Receive" anchors the user to
	// what they get; "From" makes the source job clear.
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

	// ─── State (mock — wires to txState in MVP) ───────────────────────────────
	let selectedAsset = $state<string | null>(null);
	let selectedSource = $state<string | null>(null);
	let amount = $state('');

	// Drive the step indicator state from selections.
	$effect(() => {
		if (selectedAsset && !selectedSource) stepsApi.setStep(1);
		else if (selectedAsset && selectedSource) stepsApi.setStep(2);
		else stepsApi.setStep(0);
	});

	// ─── Step 2 + 3 expand/collapse ───────────────────────────────────────────
	// We'd normally reach for the project's Collapsible.svelte (which wraps
	// @zag-js/collapsible), but its Card-baked-in layout clashes with the
	// timeline structure here. Using @zag-js/collapsible directly trips a
	// type mismatch because @zag-js/collapsible is pinned at 1.30 while
	// @zag-js/svelte floats on ^1.33 (their Machine<Schema> shapes diverge).
	//
	// For a mock — where the value of a Zag machine is mostly the a11y
	// attributes — a bound aria-expanded button + hidden content gives the
	// same semantics with no version surface area. Revisit when MVP lands and
	// the pinned versions get aligned.
	let sourceOpen = $state(false);
	let sendOpen = $state(false);
	let sourceAutoOpened = false;
	let sendAutoOpened = false;
	$effect(() => {
		if (selectedAsset && !sourceAutoOpened) {
			sourceOpen = true;
			sourceAutoOpened = true;
		}
		if (selectedSource && !sendAutoOpened) {
			sendOpen = true;
			sendAutoOpened = true;
		}
	});
	const sourceContentId = `${stepId}-source-content`;
	const sendContentId = `${stepId}-send-content`;

	// ─── Asset chips (RadioGroup + icons) ─────────────────────────────────────
	// Top-level assets the user can deposit. SATS is intentionally NOT here
	// — it's just sub-units of BTC, not a separate asset; the BTC card
	// covers it via the amount/unit selector inside step 3.
	// `disabled: true` chips render but can't be picked — used to advertise
	// roadmap assets (ETH today) without committing to the integration yet.
	const ASSETS = [
		{ value: 'hive', label: 'HIVE', icon: '/hive/hive.svg', disabled: false },
		{ value: 'hbd', label: 'HBD', icon: '/hive/hbd.svg', disabled: false },
		{ value: 'btc', label: 'BTC', icon: '/btc/btc.svg', disabled: false },
		{ value: 'eth', label: 'ETH', icon: '/eth/eth.svg', disabled: true }
	];
	type AssetValue = (typeof ASSETS)[number]['value'];

	// ─── Source picker (RadioGroup with snippets per option) ──────────────────
	// `supports` lists the assets this source can deliver DIRECTLY (no
	// intermediate swap needed). Sources not in the list are still
	// reachable via a swap-and-deposit flow, but that's a separate UX
	// decision we don't bake into this filter yet.
	//
	// Icons mirror what the real DepositOptions.svelte uses:
	//   - Lightning      → /btc/lightning.svg     (Network.lightning.icon)
	//   - Hive Mainnet   → /hive/hive.svg         (Network.hiveMainnet.icon)
	//   - Bitcoin Mainnet→ /btc/btc.svg           (Network.btcMainnet.icon)
	//   - Coinbase       → /btc/CoinBase_logo.svg (hardcoded there too)
	// Keeps the mock visually consistent with the production flow so the
	// switch later requires no design change.
	type SourceDef = {
		value: string;
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
			supports: ['hive', 'hbd']
		},
		{
			value: 'lightning',
			label: 'Lightning',
			icon: '/btc/lightning.svg',
			eta: '≈ 1 min',
			fee: '~10 sats',
			blurb: 'Scan an invoice with any Lightning wallet (Phoenix, Alby, …).',
			supports: ['btc']
		},
		{
			value: 'btc_mainnet',
			label: 'Bitcoin Mainnet',
			icon: '/btc/btc.svg',
			eta: '≈ 10 min',
			fee: 'network fee varies',
			blurb: 'Send BTC to a bridge-managed deposit address. Settles after 1 confirmation.',
			supports: ['btc']
		},
		{
			value: 'coinbase',
			label: 'Coinbase',
			icon: '/btc/CoinBase_logo.svg',
			eta: '≈ 15 min',
			fee: 'Coinbase rates apply',
			blurb: 'Buy with card and have it deposited to Magi in one step.',
			supports: ['btc']
		}
	];

	// True when the chosen source delivers a DIFFERENT asset than the one
	// the user picked in step 1, meaning the deposit will land via an
	// intermediate swap on Magi. The mock just labels it; real
	// implementation would wire in slippage/rate from the AMM.
	function isViaSwap(source: SourceDef | undefined, asset: AssetValue | null): boolean {
		if (!source || !asset) return false;
		return !source.supports.includes(asset);
	}

	// Sources sorted so direct ones (no swap needed) appear first; the
	// "via swap" alternatives come below. When no asset is picked, all
	// sources show in their declared order — useful when step 2 is
	// manually expanded out of the normal sequence.
	const sortedSources = $derived.by(() => {
		if (!selectedAsset) return [...SOURCES];
		const a = selectedAsset as AssetValue;
		return [...SOURCES].sort((s1, s2) => {
			const s1Direct = s1.supports.includes(a) ? 0 : 1;
			const s2Direct = s2.supports.includes(a) ? 0 : 1;
			return s1Direct - s2Direct;
		});
	});

	const selectedSourceDef = $derived(SOURCES.find((s) => s.value === selectedSource));
	const selectedAssetDef = $derived(ASSETS.find((a) => a.value === selectedAsset));
	const selectedIsViaSwap = $derived(
		isViaSwap(selectedSourceDef, selectedAsset as AssetValue | null)
	);

	/**
	 * Label for the asset the user is physically SENDING (out of their
	 * wallet / payment method), regardless of what they receive on Magi.
	 *
	 * The send side is dictated by the SOURCE — Lightning sends SATS,
	 * BTC mainnet sends BTC, Coinbase charges USD, etc. Hive Mainnet is
	 * the only source that has a real choice (HIVE or HBD); on direct
	 * routes the user's destination pick is also their send pick; on the
	 * via-swap route (destination = BTC) we default the send to HIVE.
	 *
	 * Step 3 uses this for the amount label ("Amount in X") and the send
	 * blurb ("Will send X …"). Without this derived, step 3 mistakenly
	 * read `selectedAssetDef.label` for the send side — wrong on every
	 * via-swap path.
	 */
	const sendAssetLabel = $derived.by(() => {
		switch (selectedSource) {
			case 'hive_mainnet':
				return selectedIsViaSwap ? 'HIVE' : (selectedAssetDef?.label ?? '—');
			case 'lightning':
				return 'SATS';
			case 'btc_mainnet':
				return 'BTC';
			case 'coinbase':
				return 'USD';
			default:
				return '—';
		}
	});

	function handleSubmit() {
		// eslint-disable-next-line no-console
		console.log('[DepositFlowMock]', {
			asset: selectedAsset,
			source: selectedSource,
			amount
		});
	}

	// ─── Recent deposits ────────────────────────────────────────────────
	// Shape the rail renders. Real entries get a `realRef` that points at
	// the transactions page's modal (same one the Transactions table opens
	// on row click — done via the `?tx=<id>&index=<i>` query string the
	// Table reads to auto-open SidePopup). Mock entries have no realRef,
	// so clicks fall back to /transactions without a pre-selected row.
	type DisplayDeposit = {
		id: string;
		asset: string;
		amount: string;
		source: string;
		timeAgo: string;
		status: 'confirmed' | 'pending';
		realRef?: { tx: string; index: number };
	};

	const MOCK_RECENT_DEPOSITS: DisplayDeposit[] = [
		{
			id: 'mock-d-001',
			asset: 'HIVE',
			amount: '125.000',
			source: 'Hive Mainnet',
			timeAgo: '2 min ago',
			status: 'confirmed'
		},
		{
			id: 'mock-d-002',
			asset: 'BTC',
			amount: '0.00420000',
			source: 'Lightning',
			timeAgo: '1 h ago',
			status: 'confirmed'
		},
		{
			id: 'mock-d-003',
			asset: 'HBD',
			amount: '50.000',
			source: 'Coinbase',
			timeAgo: '6 h ago',
			status: 'pending'
		},
		{
			id: 'mock-d-004',
			asset: 'BTC',
			amount: '0.01250000',
			source: 'Bitcoin Mainnet',
			timeAgo: 'yesterday',
			status: 'confirmed'
		}
	];

	// Try to fetch the authed user's real recent deposits. The rail goes
	// through a small state machine:
	//   - 'loading': initial state AND fetch in flight. We start here so
	//                the very first paint shows the WaveLoading spinner
	//                instead of an empty state or a mock flash; we stay
	//                here until we know whether the user is authed.
	//   - 'unauth':  auth resolved with no did. Show mock fixtures so the
	//                rail still demonstrates the layout during anonymous
	//                review.
	//   - 'loaded':  fetch done. Show real deposits, or an empty state if
	//                there were zero.
	const authValue = $derived(getAuth()());
	let depositsState = $state<'unauth' | 'loading' | 'loaded'>('loading');
	let didFetch = $state(false);
	let realDeposits = $state<DisplayDeposit[]>([]);
	// Raw tx records kept around so we can mount real <Tr> instances
	// hidden and reuse their modal-content snippets via DOM click.
	let realTxs = $state<TransactionInter[]>([]);
	// True when the underlying fetch suggests there are more deposits than
	// we display (we cap the rail at 10). Drives the "View more" button.
	let hasMoreDeposits = $state(false);
	const RECENT_DEPOSIT_LIMIT = 10;
	const RAW_TX_FETCH_LIMIT = 30;

	// ─── Transaction-detail modal state ─────────────────────────────────
	// Mirrors Table.svelte's pattern: SidePopup takes a content snippet,
	// `open` is bound, and `toggle` flips it. The snippet is whatever the
	// last-triggered Tr (or the inline mock snippet below) provides.
	let openSnippet = $state<(() => ReturnType<Snippet>) | undefined>();
	let popupOpen = $state(false);
	function captureSnippet(_op: [string, number], content: () => ReturnType<Snippet>) {
		openSnippet = content;
		popupOpen = true;
	}
	function togglePopup() {
		popupOpen = !popupOpen;
	}

	/**
	 * Format a deposit's timestamp for the rail.
	 *
	 * Rules of thumb (matches the transactions page's "MMM DD" column for
	 * older entries):
	 *   - < 24 h:  relative "X minutes/hours ago"
	 *   - < 7 d:   relative "X days ago"
	 *   - older:   explicit date "MMM DD, YYYY"
	 *
	 * moment.fromNow() shrugs anything between 10 and 21 months to "a year
	 * ago" — explicit dates remove that ambiguity (and surface a stale year
	 * in the data if there is one, which the user couldn't otherwise see).
	 */
	function formatDepositTime(ts: string): string {
		const m = moment(ts);
		if (!m.isValid()) return '—';
		const hoursAgo = moment().diff(m, 'hours');
		if (hoursAgo < 24) return m.fromNow();
		const daysAgo = moment().diff(m, 'days');
		if (daysAgo < 7) return m.fromNow();
		return m.format('MMM DD, YYYY');
	}

	function formatAmount(raw: unknown, asset: string): string {
		const dp = asset.toLowerCase() === 'btc' ? 8 : 3;
		if (typeof raw === 'number') return (raw / 10 ** dp).toFixed(dp);
		if (typeof raw === 'string') {
			const n = Number(raw);
			if (Number.isFinite(n) && raw.indexOf('.') === -1) {
				// Looks pre-shifted (smallest-unit integer string).
				return (n / 10 ** dp).toFixed(dp);
			}
			return raw;
		}
		return '—';
	}

	/** Pull out every deposit-typed entry from a single TransactionRecord. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function extractDeposits(tx: any): DisplayDeposit[] {
		// Skip outright-failed transactions — they're not "recent deposits".
		if (tx?.status === 'FAILED') return [];
		const out: DisplayDeposit[] = [];
		// Use the project's helper instead of reading anchr_ts directly:
		//   - falls back to first_seen for pre-anchored (pending) txs so
		//     unconfirmed deposits get a real "X seconds ago" instead of "—"
		//   - appends 'Z' to bare ISO strings so moment parses as UTC; the
		//     server emits e.g. "2026-06-02T23:23:33" and without the Z
		//     moment would treat it as local time and skew every timestamp
		//     by the user's UTC offset.
		const ts = tx ? getTimestamp(tx) : null;
		// Status mapping mirrors the project's existing StatusBadge logic:
		//   CONFIRMED, PROCESSED → success path → "confirmed"
		//   INCLUDED             → in a block but not state-processed yet,
		//                          rendered as "unconfirmed" in the table —
		//                          we treat as confirmed for the rail since
		//                          the deposit is on-chain at that point.
		//   UNCONFIRMED          → mempool, not in a block → "pending"
		const status: 'confirmed' | 'pending' =
			tx?.status === 'CONFIRMED' ||
			tx?.status === 'PROCESSED' ||
			tx?.status === 'INCLUDED'
				? 'confirmed'
				: 'pending';
		const source = tx?.type === 'hive' ? 'Hive Mainnet' : 'Magi';

		// Prefer ledger entries — they have the canonical post-effect asset/amount.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ledger ?? []).forEach((entry: any, index: number) => {
			if (entry?.type !== 'deposit') return;
			const assetRaw = String(entry?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-l${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(entry?.amount, assetRaw),
				source,
				timeAgo: ts ? formatDepositTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});

		if (out.length > 0) return out;

		// Fall back to ops[].type === 'deposit' (used for Hive L1 deposits).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(tx?.ops ?? []).forEach((op: any, index: number) => {
			if (op?.type !== 'deposit') return;
			const assetRaw = String(op?.data?.asset ?? '').split('_')[0] || 'hive';
			out.push({
				id: `${tx.id}-o${index}`,
				asset: assetRaw.toUpperCase(),
				amount: formatAmount(op?.data?.amount, assetRaw),
				source,
				timeAgo: ts ? formatDepositTime(ts) : '—',
				status,
				realRef: { tx: tx.id, index }
			});
		});

		return out;
	}

	$effect(() => {
		if (didFetch) return; // one-shot: don't re-fire on auth churn

		// Wait while the auth store is still resolving — keeps the
		// initial 'loading' state on screen instead of flashing.
		if (authValue.status === 'pending') return;

		didFetch = true;
		const did = authValue.value?.did;

		if (!did) {
			// Auth confirmed unauthenticated. Switch to the mock fallback so
			// reviewers without a Hive login still see the rail layout.
			depositsState = 'unauth';
			return;
		}

		// Authed — already in 'loading' from the initial state; stay there
		// until the fetch resolves.
		new GetTransactionsStore()
			.fetch({
				variables: { did, limit: RAW_TX_FETCH_LIMIT, offset: 0 },
				policy: 'NetworkOnly'
			})
			.then((result) => {
				const rawTxs = (result.data?.findTransaction ?? []) as TransactionInter[];
				const allDeposits = rawTxs.flatMap((tx) => extractDeposits(tx));

				// Cap at 10 for display. "More available" heuristic: either we
				// already extracted more than 10 deposits, or the raw fetch
				// hit the page-size limit (very likely more under the cap).
				hasMoreDeposits =
					allDeposits.length > RECENT_DEPOSIT_LIMIT ||
					rawTxs.length >= RAW_TX_FETCH_LIMIT;
				// Add `isPending: false` to satisfy TransactionInter shape that
				// the Tr component expects. The pending flag is irrelevant for
				// the modal content (Tr already reads tx.status separately).
				realTxs = rawTxs.map((tx) => ({ ...tx, isPending: false }));
				realDeposits = allDeposits.slice(0, RECENT_DEPOSIT_LIMIT);
				depositsState = 'loaded';
			})
			.catch(() => {
				// On error, fall to the empty state instead of pretending to
				// have data. Mock would lie to an authed user.
				realDeposits = [];
				depositsState = 'loaded';
			});
	});

	// What the template actually iterates over. Mocks ONLY in the unauth
	// case (preview / review without a session). For an authed user with
	// no deposits we show an empty state, not fake data.
	const displayDeposits = $derived<DisplayDeposit[]>(
		depositsState === 'unauth' ? MOCK_RECENT_DEPOSITS : realDeposits
	);

	/** Last-clicked DisplayDeposit, used so the inline mock-modal snippet
	 *  can read the deposit's fields when SidePopup re-renders it. */
	let activeMockDeposit = $state<DisplayDeposit | null>(null);

	function handleDepositClick(d: DisplayDeposit) {
		if (d.realRef) {
			// Programmatically click the matching hidden <Tr>. That fires
			// Tr's own handleTrigger, which calls our `captureSnippet`
			// callback with Tr's `thisRowContent` snippet — i.e. the
			// exact modal body the /transactions page renders.
			const root = document.querySelector(
				`[data-mock-tr-deposit-id="${CSS.escape(d.id)}"] tr.clickable-row`
			) as HTMLElement | null;
			root?.click();
		} else {
			// Mock entries don't have a real tx; show a small inline snippet
			// in the same SidePopup so reviewers still see the modal feature
			// work even without real deposits in the account.
			activeMockDeposit = d;
			openSnippet = mockDepositSnippet;
			popupOpen = true;
		}
	}

	function reset() {
		selectedAsset = null;
		selectedSource = null;
		amount = '';
		sourceOpen = false;
		sendOpen = false;
		sourceAutoOpened = false;
		sendAutoOpened = false;
	}
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
			Uses the project's purple Tooltip component for the explanation
			(matches what's used elsewhere on the swap/quickswap pages).
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
			flow. Production uses size=40 inside a 40px renderer; here we drop
			the visible size to 28px to fit the compact source-card layout
			while keeping the asset visually identifiable.
		-->
		<div class="source-icon">
			<img src={def.icon} alt={def.label} width="28" height="28" />
		</div>
		<div class="source-body">
			<!--
				Head row layout:
				  - left: label (badge is no longer inline; lives on the card top)
				  - right: eta · fee meta
				The head is a flex-wrap row. On wide-enough cards both sit on
				one line; on narrow cards the meta drops below.
			-->
			<div class="source-head">
				<span class="source-label">{def.label}</span>
				<!--
					ETA + fee moved into the tooltip on this Info icon. Frees
					the card head to be label-only — much quieter at a glance,
					and the details are still one hover away. Same purple
					Tooltip component used by the "via swap" badge for
					visual consistency.
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

<div class="page">
	<div class="main">
		<header class="page-head">
			<h2>Deposit</h2>
			<p class="lead">Add funds to your Magi balance.</p>
		</header>

		<!-- Timeline (Zag steps machine drives indicator state only) -->
		<div {...stepsApi.getRootProps()} class="timeline">
			<!-- ─── Step 1: Asset ────────────────────────────────────────── -->
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
								bind:value={selectedAsset}
							/>
							<button class="other-asset-btn" type="button" disabled aria-label="Search for another asset">
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
					<button
						class="step-toggle"
						type="button"
						aria-expanded={sourceOpen}
						aria-controls={sourceContentId}
						disabled={!selectedAsset}
						data-state={sourceOpen ? 'open' : 'closed'}
						onclick={() => (sourceOpen = !sourceOpen)}
					>
						<span class="step-heading">{stepDefs[1].label}</span>
						{#if selectedSourceDef && !sourceOpen}
							<span class="step-summary">{selectedSourceDef.label}</span>
						{/if}
						<ChevronDown class="step-chevron" size={16} />
					</button>
					<div
						id={sourceContentId}
						class="collapse-content"
						hidden={!sourceOpen}
						data-state={sourceOpen ? 'open' : 'closed'}
					>
						<div class="step-body source-picker">
							<RadioGroup
								items={sortedSources.map((s) => {
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
								bind:value={selectedSource}
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- ─── Step 3: Send (collapsible) ───────────────────────────── -->
			<div {...stepsApi.getItemProps({ index: 2 })} class="timeline-item">
				<div {...stepsApi.getIndicatorProps({ index: 2 })} class="timeline-indicator">
					{#if stepsApi.value > 2}
						<Check size={14} strokeWidth={3} />
					{:else}
						3
					{/if}
				</div>
				<div class="timeline-content">
					<button
						class="step-toggle"
						type="button"
						aria-expanded={sendOpen}
						aria-controls={sendContentId}
						disabled={!selectedSource}
						data-state={sendOpen ? 'open' : 'closed'}
						onclick={() => (sendOpen = !sendOpen)}
					>
						<span class="step-heading">{stepDefs[2].label}</span>
						<ChevronDown class="step-chevron" size={16} />
					</button>
					<div
						id={sendContentId}
						class="collapse-content"
						hidden={!sendOpen}
						data-state={sendOpen ? 'open' : 'closed'}
					>
						<div class="step-body">
							{#if selectedSourceDef}
								<div class="send-block">
									{#if selectedIsViaSwap}
										<!-- Flat indicator: this source delivers a DIFFERENT asset,
										     and a swap on Magi converts it to the one the user picked.
										     Step 3 stays simple (no rate / slippage UI yet) — that's a
										     future iteration once we wire real AMM quotes in here. -->
										<p class="via-swap-note">
											Includes a swap to <strong>{selectedAssetDef?.label}</strong> on Magi.
										</p>
									{/if}
									{#if selectedSource === 'hive_mainnet'}
										<label for="amount" class="amount-label">
											Amount in {sendAssetLabel}
										</label>
										<input
											id="amount"
											type="text"
											placeholder="0.000"
											bind:value={amount}
										/>
										<p class="send-detail">
											Will send <strong>{amount || '0.000'} {sendAssetLabel}</strong>
											to <code>vsc.gateway</code> with memo
											<code>to=&lt;yourusername&gt;</code>.
										</p>
										<button class="cta" type="button" onclick={handleSubmit}>
											Approve in Keychain
										</button>
									{:else if selectedSource === 'lightning'}
										<label for="amount" class="amount-label">Amount in SATS</label>
										<input
											id="amount"
											type="text"
											placeholder="1000"
											bind:value={amount}
										/>
										<p class="send-detail">
											A Lightning invoice will be generated; pay it with any LN
											wallet to credit your Magi balance.
										</p>
										<button class="cta" type="button" onclick={handleSubmit}>
											Generate invoice
										</button>
									{:else if selectedSource === 'btc_mainnet'}
										<p class="send-detail">
											Send any amount of BTC to your bridge-managed address:
										</p>
										<code class="address">bc1q…mock_address_for_review…</code>
										<div class="qr-placeholder">[ QR code placeholder ]</div>
										<button class="cta cta-secondary" type="button" onclick={handleSubmit}>
											Open in Bitcoin wallet
										</button>
									{:else if selectedSource === 'coinbase'}
										<label for="amount" class="amount-label">USD amount</label>
										<input
											id="amount"
											type="text"
											placeholder="$50.00"
											bind:value={amount}
										/>
										<p class="send-detail">
											Coinbase will charge your card and bridge the result to Magi.
										</p>
										<button class="cta" type="button" onclick={handleSubmit}>
											Continue with Coinbase
										</button>
									{/if}
								</div>
							{:else}
								<p class="locked-hint">Select a source above to continue.</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="actions">
			<button type="button" class="link" onclick={reset}>Reset mock</button>
		</div>
	</div>

	<aside class="rail">
		<section>
			<h5>Recent deposits</h5>
			<!--
				Three rendered states:
				  - loading: WaveLoading (consistent with LineChart's loading)
				  - loaded + empty: small "no recent deposits" empty state
				  - has items: the list (real for authed users with data,
				    or mock fixtures for unauthenticated previews)
			-->
			{#if depositsState === 'loading'}
				<div class="recent-loading">
					<WaveLoading size={18} />
				</div>
			{:else if displayDeposits.length === 0}
				<p class="rail-empty">No recent deposits yet.</p>
			{:else}
				<ul class="recent-list">
					{#each displayDeposits as d (d.id)}
						<li>
							<button
								class="recent-item"
								type="button"
								onclick={() => handleDepositClick(d)}
							>
								<div class="recent-icon" data-status={d.status}>
									{#if d.status === 'confirmed'}
										<Check size={12} strokeWidth={3} />
									{:else}
										<Clock size={12} />
									{/if}
								</div>
								<div class="recent-body">
									<div class="recent-top">
										<span class="recent-amount">+{d.amount} {d.asset}</span>
										<span class="recent-time">{d.timeAgo}</span>
									</div>
									<div class="recent-bottom">
										<span class="recent-source">from {d.source}</span>
										{#if d.status === 'pending'}
											<span class="recent-status pending">pending</span>
										{/if}
									</div>
								</div>
							</button>
						</li>
					{/each}
				</ul>
				{#if hasMoreDeposits}
					<a class="recent-view-more" href="/transactions">
						View all deposits →
					</a>
				{/if}
			{/if}
		</section>

		<section>
			<h5>FAQ</h5>
			<Collapsible>
				{#snippet children()}<span>How long does a deposit take?</span>{/snippet}
				{#snippet content()}
					<div class="faq-body">
						<p>Depends on the source you pick:</p>
						<ul>
							<li><strong>Hive Mainnet</strong> — instant once your block confirms</li>
							<li><strong>Lightning</strong> — about a minute</li>
							<li><strong>Bitcoin Mainnet</strong> — about 10 minutes (1 confirmation)</li>
							<li><strong>Coinbase</strong> — around 15 minutes after the card charge</li>
						</ul>
						<p>Each option shows its ETA in step 2.</p>
					</div>
				{/snippet}
			</Collapsible>
			<Collapsible>
				{#snippet children()}<span>Are there fees?</span>{/snippet}
				{#snippet content()}
					<div class="faq-body">
						<ul>
							<li><strong>Hive Mainnet</strong> — free</li>
							<li><strong>Lightning</strong> — small gateway fee (~10 sats)</li>
							<li><strong>Bitcoin Mainnet</strong> — pays the on-chain network fee</li>
							<li><strong>Coinbase</strong> — Coinbase&rsquo;s card-processing fee applies</li>
						</ul>
						<p>
							If your route says <em>via swap</em>, an extra AMM fee from the on-chain pool
							applies on top.
						</p>
					</div>
				{/snippet}
			</Collapsible>
			<Collapsible>
				{#snippet children()}<span>Deposit hasn&rsquo;t arrived?</span>{/snippet}
				{#snippet content()}
					<div class="faq-body">
						<p>Most deposits show as <em>pending</em> in the
							<a href="/transactions">Transactions</a> page before confirming. If you don&rsquo;t see one:
						</p>
						<ol>
							<li>For Bitcoin Mainnet, allow at least 1 on-chain confirmation (~10 min).</li>
							<li>For Lightning, check that the invoice was actually paid (not just generated).</li>
							<li>Refresh the Transactions page — there&rsquo;s no live polling yet.</li>
							<li>Still missing? Share the source tx id with support.</li>
						</ol>
					</div>
				{/snippet}
			</Collapsible>
			<Collapsible>
				{#snippet children()}<span>What does &ldquo;via swap&rdquo; mean?</span>{/snippet}
				{#snippet content()}
					<div class="faq-body">
						<p>
							The source you picked delivers a different asset than the one you
							want to receive. Magi accepts what the source sends, then runs an
							on-chain swap into your chosen asset before crediting your balance.
						</p>
						<p>
							For example, &ldquo;Receive HIVE&rdquo; + &ldquo;From Coinbase&rdquo; charges your card as
							USD, deposits BTC, then swaps BTC&nbsp;→&nbsp;HIVE on the Magi DEX. The whole
							thing happens in one flow.
						</p>
					</div>
				{/snippet}
			</Collapsible>
		</section>
	</aside>
</div>

<!--
	Hidden Tr instances — one per REAL deposit row in the rail. They render
	the transactions-table row markup but stay visually hidden. When the
	user clicks our compact recent-deposit button we DOM-dispatch a click
	on the corresponding `tr.clickable-row` here, which fires Tr's own
	`handleTrigger` → `onRowClick(op, thisRowContent)`. Our `captureSnippet`
	callback then plugs `thisRowContent` into the SidePopup below — exact
	same modal as the /transactions page.

	Wrapped in a <table>/<tbody> because <tr> must live in one to render.
-->
<div class="hidden-tr-mount" aria-hidden="true">
	{#each realDeposits ?? [] as d (d.id)}
		{#if d.realRef}
			{@const tx = realTxs.find((t) => t.id === d.realRef!.tx)}
			{@const op = tx?.ops?.[d.realRef.index]}
			{#if tx && op}
				<table data-mock-tr-deposit-id={d.id}>
					<tbody>
						<Tr {tx} {op} onRowClick={captureSnippet} />
					</tbody>
				</table>
			{/if}
		{/if}
	{/each}
</div>

<!--
	Mock-deposit snippet — used when the clicked recent deposit doesn't
	have a real on-chain tx (the fallback fixtures). Reuses SidePopup so
	reviewers still see modal behavior even without real deposits.
-->
{#snippet mockDepositSnippet()}
	{#if activeMockDeposit}
		<h3 class="mock-modal-title">Deposit · {activeMockDeposit.asset}</h3>
		<p class="mock-modal-amount">+{activeMockDeposit.amount} {activeMockDeposit.asset}</p>
		<dl class="mock-modal-fields">
			<div>
				<dt>From</dt>
				<dd>{activeMockDeposit.source}</dd>
			</div>
			<div>
				<dt>When</dt>
				<dd>{activeMockDeposit.timeAgo}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd class="mock-modal-status" data-status={activeMockDeposit.status}>
					{activeMockDeposit.status}
				</dd>
			</div>
		</dl>
		<p class="mock-modal-hint">
			This is mock data. Sign in with a Hive account that has real deposits
			to see live transaction details here.
		</p>
	{/if}
{/snippet}

<SidePopup content={openSnippet} bind:open={popupOpen} toggle={togglePopup} />

<style lang="scss">
	$accent: #6f6af8;
	$accent-soft: rgba(111, 106, 248, 0.16);
	$border: rgba(255, 255, 255, 0.09);
	$border-strong: rgba(255, 255, 255, 0.16);
	$surface: rgba(255, 255, 255, 0.035);
	$surface-strong: rgba(255, 255, 255, 0.06);

	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		/* Generous horizontal gap on wide layouts so the flow column and
		   the FAQ rail clearly read as separate concerns. When the layout
		   collapses to a single column (≤1440px), the same value works as
		   the VERTICAL gap between flow and FAQ stacked below. */
		gap: 4rem;
		max-width: 66rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
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

	/* ─── Step toggle (collapsible trigger) ──────────────────────────────── */
	.step-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.4rem 0;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.step-toggle:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.step-summary {
		font-size: 0.85rem;
		color: $accent;
		background: $accent-soft;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.step-toggle :global(.step-chevron) {
		margin-left: auto;
		transition: transform 200ms ease;
		color: var(--dash-text-secondary);
	}
	.step-toggle[data-state='open'] :global(.step-chevron) {
		transform: rotate(180deg);
	}

	/* ─── Collapse animation ─────────────────────────────────────────────── */
	.collapse-content[data-state='open'] {
		animation: slideDown 220ms ease;
	}
	@keyframes slideDown {
		from { opacity: 0.01; transform: translateY(-4px); }
		to   { opacity: 1; transform: translateY(0); }
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
	.source-picker :global([data-scope='radio-group'][data-part='root']) :global(.items) > :global(*) {
		width: 100%;
		min-width: 0;
	}
	/* Give each source row real breathing room as a clickable card.
	   RadioGroup's default item padding (0.25rem 0.75rem) is tight for
	   full-width rows. */
	.source-picker :global([data-scope='radio-group'][data-part='item']) {
		padding: 1.1rem 1.25rem;
		height: auto; /* override RadioGroup's 2.5rem default — cards need to size to content */
		border-radius: 14px;
		border: 1px solid $border;
		transition: background-color 150ms ease, border-color 150ms ease;
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
	/* Pin each asset chip to a content-sized fixed width and KILL flex-grow,
	   otherwise RadioGroup's `flex-grow: 1` blows them up to fill the row
	   when one of them wraps to a new line (3-letter ticker pills suddenly
	   become 200px wide). Width is just enough for the icon + a 4-char
	   ticker + the chip's own 0.25rem 0.75rem padding. */
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
	/* Icon-only tile — no background pill behind the SVG. Real production
	   icons (e.g. Coinbase logo, lightning bolt) carry their own visual
	   weight; the previous accent-purple plate competed with them. */
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
	/* Info icon in the source-card head. Hover/focus reveals a styled
	   purple Tooltip with the eta + fee. Position is relative so the
	   Tooltip child can position itself above. */
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
	/* Tooltip body needs to overflow the parent's default `white-space:
	   nowrap` so we can stack two rows. Flex column does that and keeps
	   each row's icon + value tight. */
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

	/* "via swap" treatment — keeps direct sources prominent while making
	   cross-asset ones reachable but visually de-emphasized. Subtle enough
	   that someone scanning the list for a direct option still spots it
	   first; visible enough that the swap path is still discoverable. */
	/* Via-swap icon: no background, just slight desaturation + opacity so
	   direct sources still visually win without needing a contrast tile. */
	:global(.source-card.via-swap) :global(.source-icon img) {
		filter: saturate(0.55);
		opacity: 0.75;
	}
	/* Top-center pinned badge. Sits INSIDE the card top edge (not straddling
	   it), so it reads clearly as a property of this card and doesn't
	   visually overflow into the gap between rows. All "via swap" badges
	   line up across a vertical stack since each card has the same width.
	   The closest positioned ancestor is RadioGroup's `[data-part='item']`
	   (which is `position: relative` in its own CSS). Visual style matches
	   `.network-pill` in SwapOptions.svelte. */
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
	/* Tooltip reveal: Tooltip.svelte expects a position:relative parent that
	   sets `:hover .tooltip { opacity: 1; visibility: visible }`. The badge
	   is position:absolute (which also creates a positioning context), so
	   the same pattern works for its child tooltip. */
	:global(.via-swap-badge:hover) :global(.tooltip),
	:global(.via-swap-badge:focus-visible) :global(.tooltip) {
		opacity: 1;
		visibility: visible;
	}
	:global(.via-swap-badge:focus-visible) {
		box-shadow: 0 0 0 2px rgba(111, 106, 248, 0.4);
	}
	.via-swap-note {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.25rem;
		padding: 0.55rem 0.75rem;
		font-size: 0.82rem;
		color: var(--dash-text-secondary);
		background: rgba(111, 106, 248, 0.08);
		border: 1px solid rgba(111, 106, 248, 0.22);
		border-radius: 8px;
	}
	.via-swap-note strong {
		color: var(--dash-text-primary);
	}

	/* ─── Step 3: send block ─────────────────────────────────────────────── */
	.send-block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.15rem 1.25rem;
		background: $surface;
		border: 1px solid $border;
		border-radius: 14px;
	}
	.amount-label {
		font-size: 0.78rem;
		color: var(--dash-text-secondary);
		font-weight: 600;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.send-block input {
		font: inherit;
		font-size: 1.15rem;
		background: transparent;
		border: 1px solid $border-strong;
		color: inherit;
		border-radius: 10px;
		padding: 0.6rem 0.8rem;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}
	.send-block input:focus {
		outline: none;
		border-color: $accent;
		box-shadow: 0 0 0 3px rgba(111, 106, 248, 0.18);
	}
	.send-detail {
		margin: 0;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
		line-height: 1.5;
	}
	.send-detail code,
	.address {
		font-family: 'Noto Sans Mono', monospace;
		background: $surface-strong;
		padding: 0.1rem 0.4rem;
		border-radius: 6px;
		font-size: 0.85em;
	}
	.address {
		display: block;
		padding: 0.6rem 0.75rem;
		word-break: break-all;
	}
	.qr-placeholder {
		background: $surface;
		border: 1px dashed $border-strong;
		border-radius: 12px;
		padding: 2.5rem;
		text-align: center;
		color: var(--dash-text-muted);
		font-size: 0.85rem;
	}
	.cta {
		background: $accent;
		border: 0;
		color: #fff;
		padding: 0.8rem 1rem;
		border-radius: 12px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 150ms ease, transform 100ms ease;
	}
	.cta:hover {
		background: #807cff;
	}
	.cta:active {
		transform: translateY(1px);
	}
	.cta-secondary {
		background: $surface-strong;
	}
	.cta-secondary:hover {
		background: rgba(255, 255, 255, 0.1);
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

	/* ─── Reset link ─────────────────────────────────────────────────────── */
	.actions {
		margin-top: 2rem;
	}
	.link {
		background: none;
		border: 0;
		color: var(--dash-text-secondary);
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
		padding: 0;
		font-size: 0.85rem;
	}
	.link:hover {
		color: var(--dash-text-primary);
	}

	/* ─── Right rail ─────────────────────────────────────────────────────── */
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

	/* ── FAQ content ─────────────────────────────────────────────────────
	   Explicit weight: 400 on paragraphs and list items — the default
	   inheritance from the Card / button context was rendering things
	   slightly heavier than they should. Strong tags inside list items
	   stay 600 so the lead phrase still reads as a label. */
	:global(.faq-body) {
		font-size: 0.83rem;
		line-height: 1.5;
		color: var(--dash-text-secondary);
		font-weight: 400;
	}
	:global(.faq-body p) {
		margin: 0 0 0.5rem;
		font-weight: 400;
	}
	:global(.faq-body p:last-child) {
		margin-bottom: 0;
	}
	:global(.faq-body ul),
	:global(.faq-body ol) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
	}
	:global(.faq-body li) {
		margin: 0.25rem 0;
		font-weight: 400;
	}
	:global(.faq-body li::marker) {
		color: var(--dash-text-muted);
	}
	:global(.faq-body strong) {
		color: var(--dash-text-primary);
		font-weight: 600;
	}
	:global(.faq-body em) {
		font-style: italic;
		color: var(--dash-text-primary);
	}
	:global(.faq-body a) {
		color: $accent;
		text-decoration: none;
		border-bottom: 1px solid rgba(111, 106, 248, 0.35);
	}
	:global(.faq-body a:hover) {
		border-bottom-color: $accent;
	}

	/* ── Recent deposits ──────────────────────────────────────────────── */
	.recent-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	/* Recent-deposit row. It's a <button> so clicks open the SidePopup
	   inline instead of navigating. Real entries dispatch a DOM click on a
	   hidden <Tr> elsewhere on the page; mock entries open a custom snippet
	   in the same SidePopup. */
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
		cursor: pointer;
		width: 100%;
		transition: background-color 150ms ease, border-color 150ms ease;
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
	.recent-icon[data-status='confirmed'] {
		background: rgba(74, 222, 128, 0.18);
		color: #6ee7a1;
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
		font-weight: 400;
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
	/* WaveLoading container while the user's recent deposits fetch is in
	   flight. Sized to roughly match a few collapsed rows so the layout
	   doesn't jump when results land. */
	.recent-loading {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1rem 0;
		color: var(--dash-text-secondary);
	}
	/* Shown only when the underlying fetch suggests there are deposits
	   beyond the 10 we render in the rail. Sends the user to the full
	   transactions table. */
	.recent-view-more {
		display: inline-flex;
		margin-top: 0.5rem;
		padding: 0.45rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: $accent;
		text-decoration: none;
		border-radius: 8px;
		transition: background-color 150ms ease;
	}
	.recent-view-more:hover {
		background: $accent-soft;
	}

	/* Below 1440px the 18rem right rail squeezes the main column too hard —
	   the source cards lose their breathing room and the FAQ rail itself
	   gets cramped. Drop the rail under the main content instead so each
	   gets full width. Tightened mobile padding only kicks in below 720px. */
	@media (max-width: 1440px) {
		.page {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.page {
			padding: 1.25rem 1rem 3rem;
		}
	}

	/* Hidden <Tr> instances. They must render to be clickable, but they
	   shouldn't visually appear in the layout. `position: absolute` lifts
	   them out of flow; the negative offset + zero size keeps them
	   off-screen but still part of the DOM so .click() works on them. */
	.hidden-tr-mount {
		position: absolute;
		left: -9999px;
		top: 0;
		width: 0;
		height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	/* Mock-deposit modal content (shown in SidePopup when a fallback
	   fixture is clicked). Kept structurally similar to the real Tr
	   snippet so reviewers can see what shape the popup will eventually
	   take when real data flows. */
	.mock-modal-title {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
	}
	.mock-modal-amount {
		margin: 0 0 1rem;
		font-size: 1.6rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--dash-text-primary);
	}
	.mock-modal-fields {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 0.5rem 1rem;
		margin: 0 0 1rem;
		font-size: 0.88rem;
	}
	.mock-modal-fields > div {
		display: contents;
	}
	.mock-modal-fields dt {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dash-text-secondary);
		font-weight: 600;
		padding-top: 0.15rem;
	}
	.mock-modal-fields dd {
		margin: 0;
		color: var(--dash-text-primary);
	}
	.mock-modal-status {
		text-transform: capitalize;
		font-weight: 500;
	}
	.mock-modal-status[data-status='confirmed'] {
		color: #6ee7a1;
	}
	.mock-modal-status[data-status='pending'] {
		color: #f5c451;
	}
	.mock-modal-hint {
		font-size: 0.78rem;
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
		padding: 0.6rem 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px dashed rgba(255, 255, 255, 0.1);
		border-radius: 8px;
	}
</style>
