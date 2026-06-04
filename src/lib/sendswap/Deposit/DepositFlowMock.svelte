<!--
	Deposit flow redesign — lo-fi mock.

	Throwaway: this component is a static/clickable mock for design review.
	It mounts NO real wallet, signer, or txState — every "Continue" button
	is a console.log. The goal is to evaluate the 3-step timeline UX
	(Asset → Source → Send) before refactoring DepositOptions.svelte.

	Zag-first per project convention: every interactive piece composes an
	existing Zag wrapper (RadioGroup, Collapsible) or @zag-js/steps directly.
	No custom-built radio buttons, dropdowns, or step indicators.

	Delete this file once the MVP lands in production code.
-->
<script lang="ts">
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Collapsible from '$lib/zag/Collapsible.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { Bitcoin, Coins, DollarSign, Search, Zap, Check } from '@lucide/svelte';

	// ─── Step machine (Zag) ───────────────────────────────────────────────────
	const stepDefs = [
		{ id: 'asset', label: 'Select Asset' },
		{ id: 'source', label: 'Select Source' },
		{ id: 'send', label: 'Send' }
	] as const;

	const stepId = $props.id();
	const service = useMachine(steps.machine, {
		id: stepId,
		orientation: 'vertical',
		count: stepDefs.length,
		linear: true
	});
	const api = $derived(steps.connect(service, normalizeProps));

	// ─── State (mock — replace with txState in MVP) ────────────────────────────
	let selectedAsset = $state<string | undefined>(undefined);
	let selectedSource = $state<string | undefined>(undefined);
	let amount = $state('');

	// Advance the step machine based on what the user has picked.
	$effect(() => {
		if (selectedAsset && !selectedSource) api.setStep(1);
		else if (selectedAsset && selectedSource) api.setStep(2);
		else api.setStep(0);
	});

	// ─── Asset chips (RadioGroup) ─────────────────────────────────────────────
	const ASSETS = [
		{ value: 'hive', label: 'HIVE' },
		{ value: 'hbd', label: 'HBD' },
		{ value: 'btc', label: 'BTC' },
		{ value: 'sats', label: 'SATS' }
	];

	// ─── Source picker (RadioGroup with snippets) ─────────────────────────────
	// Each source has its own eta + fee blurb shown inline on the card.
	type SourceDef = {
		value: string;
		label: string;
		icon: typeof Coins;
		eta: string;
		fee: string;
		blurb: string;
	};
	const SOURCES: SourceDef[] = [
		{
			value: 'hive_mainnet',
			label: 'Hive Mainnet',
			icon: Coins,
			eta: 'instant',
			fee: 'no fee',
			blurb: 'Send from your connected Hive wallet (Keychain, PeakVault, …).'
		},
		{
			value: 'lightning',
			label: 'Lightning',
			icon: Zap,
			eta: '≈ 1 min',
			fee: '~10 sats',
			blurb: 'Scan an invoice with any Lightning wallet (Phoenix, Alby, …).'
		},
		{
			value: 'btc_mainnet',
			label: 'Bitcoin Mainnet',
			icon: Bitcoin,
			eta: '≈ 10 min',
			fee: 'network fee varies',
			blurb: 'Send BTC to a bridge-managed deposit address. Settles after 1 confirmation.'
		},
		{
			value: 'coinbase',
			label: 'Coinbase',
			icon: DollarSign,
			eta: '≈ 15 min',
			fee: 'Coinbase rates apply',
			blurb: 'Buy with card and have it deposited to Magi in one step.'
		}
	];

	const selectedSourceDef = $derived(SOURCES.find((s) => s.value === selectedSource));

	function handleSubmit() {
		// Mock: log instead of broadcasting.
		// eslint-disable-next-line no-console
		console.log('[DepositFlowMock]', {
			asset: selectedAsset,
			source: selectedSource,
			amount
		});
	}

	function reset() {
		selectedAsset = undefined;
		selectedSource = undefined;
		amount = '';
	}
</script>

<!--
	One snippet per source (mirrors the HiveLogin.svelte pattern). RadioGroup's
	`Item` generic is self-referential — a single shared snippet hits a
	recursive-type mismatch. 4 snippets that close over their own SOURCES
	entry sidesteps it without casts, at the cost of verbosity that's
	tolerable for a mock.
-->
{#snippet hiveMainnetCard()}
	{@render sourceCardLayout(SOURCES[0])}
{/snippet}
{#snippet lightningCard()}
	{@render sourceCardLayout(SOURCES[1])}
{/snippet}
{#snippet btcMainnetCard()}
	{@render sourceCardLayout(SOURCES[2])}
{/snippet}
{#snippet coinbaseCard()}
	{@render sourceCardLayout(SOURCES[3])}
{/snippet}

{#snippet sourceCardLayout(def: (typeof SOURCES)[number])}
	{@const Icon = def.icon}
	<div class="source-card">
		<div class="source-icon">
			<Icon size={20} />
		</div>
		<div class="source-body">
			<div class="source-head">
				<span class="source-label">{def.label}</span>
				<span class="source-meta">{def.eta} · {def.fee}</span>
			</div>
			<p class="source-blurb">{def.blurb}</p>
		</div>
	</div>
{/snippet}

<div class="page">
	<div class="main">
		<h2>Deposit</h2>
		<p class="lead">
			Add funds to your Magi balance from any of your connected wallets.
		</p>

		<!-- Zag step machine timeline (vertical) -->
		<div {...api.getRootProps()} class="timeline">
			{#each stepDefs as step, i}
				<div {...api.getItemProps({ index: i })} class="timeline-item">
					<div {...api.getIndicatorProps({ index: i })} class="timeline-indicator">
						{#if api.value > i}
							<Check size={14} />
						{:else}
							{i + 1}
						{/if}
					</div>
					<div class="timeline-content">
						<h4>{step.label}</h4>

						{#if step.id === 'asset'}
							<div class="step-body">
								<RadioGroup items={ASSETS} bind:value={selectedAsset} />
								<button class="search-trigger" type="button" disabled>
									<Search size={14} /> Other asset…
								</button>
							</div>
						{:else if step.id === 'source'}
							<div class="step-body" class:locked={!selectedAsset}>
								<RadioGroup
									items={[
										{ value: SOURCES[0].value, snippet: hiveMainnetCard },
										{ value: SOURCES[1].value, snippet: lightningCard },
										{ value: SOURCES[2].value, snippet: btcMainnetCard },
										{ value: SOURCES[3].value, snippet: coinbaseCard }
									]}
									bind:value={selectedSource}
								/>
							</div>
						{:else if step.id === 'send'}
							<div class="step-body" class:locked={!selectedSource}>
								{#if selectedSourceDef}
									{#if selectedSource === 'hive_mainnet'}
										<div class="send-block">
											<label for="amount" class="amount-label">Amount</label>
											<input
												id="amount"
												type="text"
												placeholder="0.000"
												bind:value={amount}
											/>
											<p class="send-detail">
												Will send <strong>{amount || '0.000'} {selectedAsset?.toUpperCase()}</strong>
												to <code>vsc.gateway</code> with memo
												<code>to=&lt;yourusername&gt;</code>.
											</p>
											<button class="cta" type="button" onclick={handleSubmit}>
												Approve in Keychain
											</button>
										</div>
									{:else if selectedSource === 'lightning'}
										<div class="send-block">
											<label for="amount" class="amount-label">Amount in sats</label>
											<input
												id="amount"
												type="text"
												placeholder="1000"
												bind:value={amount}
											/>
											<p class="send-detail">
												A Lightning invoice will be generated; pay it with any LN wallet.
											</p>
											<button class="cta" type="button" onclick={handleSubmit}>
												Generate Invoice
											</button>
										</div>
									{:else if selectedSource === 'btc_mainnet'}
										<div class="send-block">
											<p class="send-detail">
												Send any amount of BTC to your bridge-managed address:
											</p>
											<code class="address">bc1q…mock_address_for_review…</code>
											<div class="qr-placeholder">[ QR code placeholder ]</div>
											<button class="cta cta-secondary" type="button" onclick={handleSubmit}>
												Open in Bitcoin Wallet
											</button>
										</div>
									{:else if selectedSource === 'coinbase'}
										<div class="send-block">
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
										</div>
									{/if}
								{:else}
									<p class="locked-hint">Select a source above to continue.</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="actions">
			<button type="button" class="link" onclick={reset}>Reset mock</button>
		</div>
	</div>

	<aside class="rail">
		<section>
			<h5>FAQ</h5>
			<Collapsible>
				{#snippet children()}<span>How long does a deposit take?</span>{/snippet}
				{#snippet content()}
					<p>
						Depends on the source you pick — instant for Hive, ~1 min for Lightning,
						~10 min for BTC mainnet, ~15 min for Coinbase. Step 2 shows the ETA per
						source.
					</p>
				{/snippet}
			</Collapsible>
			<Collapsible>
				{#snippet children()}<span>Are there fees?</span>{/snippet}
				{#snippet content()}
					<p>
						Hive Mainnet and Magi-internal moves are free. Lightning incurs a small
						gateway fee (~10 sats). BTC mainnet pays the on-chain network fee.
						Coinbase charges its own card processing fee.
					</p>
				{/snippet}
			</Collapsible>
			<Collapsible>
				{#snippet children()}<span>Deposit hasn't arrived?</span>{/snippet}
				{#snippet content()}
					<p>
						Check the transactions page first — most deposits show as <em>pending</em>
						before they confirm. For BTC mainnet, allow at least 1 confirmation. If
						still missing, share the tx ID with support.
					</p>
				{/snippet}
			</Collapsible>
		</section>

		<section>
			<h5>Recent deposits</h5>
			<p class="rail-empty">No recent deposits.</p>
		</section>
	</aside>
</div>

<style lang="scss">
	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 2rem;
		max-width: 64rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	h2 {
		margin: 0 0 0.25rem;
	}
	.lead {
		color: var(--dash-text-secondary);
		margin: 0 0 2rem;
	}

	/* ─── Timeline ──────────────────────────────────────────────────────── */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.timeline-item {
		display: grid;
		grid-template-columns: 2.5rem 1fr;
		gap: 1rem;
		position: relative;
	}
	/* connecting line between indicators */
	.timeline-item:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 2.5rem;
		left: 1.2rem;
		bottom: -1rem;
		width: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
	.timeline-indicator {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.04);
		font-weight: 600;
		color: var(--dash-text-secondary);
		font-size: 0.9rem;
	}
	.timeline-indicator[data-state='current'] {
		border-color: #6f6af8;
		background: rgba(111, 106, 248, 0.15);
		color: #fff;
	}
	.timeline-indicator[data-state='complete'] {
		border-color: #6f6af8;
		background: #6f6af8;
		color: #fff;
	}
	.timeline-content h4 {
		margin: 0.4rem 0 0.6rem;
		font-size: 1rem;
		font-weight: 600;
	}
	.step-body.locked {
		opacity: 0.4;
		pointer-events: none;
	}

	/* ─── Step 1 search button ───────────────────────────────────────────── */
	.search-trigger {
		margin-top: 0.75rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: 1px dashed rgba(255, 255, 255, 0.18);
		color: var(--dash-text-secondary);
		border-radius: 12px;
		padding: 0.4rem 0.75rem;
		font: inherit;
		cursor: not-allowed;
	}

	/* ─── Step 2 source card (inside RadioGroup snippet) ─────────────────── */
	:global(.source-card) {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.85rem;
		align-items: start;
		width: 100%;
		padding: 0.5rem 0;
	}
	:global(.source-icon) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		background: rgba(111, 106, 248, 0.15);
		color: #b0acff;
	}
	:global(.source-head) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: baseline;
	}
	:global(.source-label) {
		font-weight: 600;
	}
	:global(.source-meta) {
		font-size: 0.8rem;
		color: var(--dash-text-secondary);
	}
	:global(.source-blurb) {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
		line-height: 1.35;
	}

	/* Force the source picker's RadioGroup items onto their own rows */
	.timeline-item :global(.items) :global(.source-card) ~ :global(*) {
		display: block;
	}

	/* ─── Step 3 send block ─────────────────────────────────────────────── */
	.send-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 12px;
	}
	.amount-label {
		font-size: 0.8rem;
		color: var(--dash-text-secondary);
		font-weight: 600;
		margin: 0;
	}
	.send-block input {
		font: inherit;
		font-size: 1.1rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: inherit;
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
	}
	.send-block input:focus {
		outline: 2px solid #6f6af8;
		outline-offset: 1px;
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
		background: rgba(255, 255, 255, 0.06);
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
		background: rgba(255, 255, 255, 0.04);
		border: 1px dashed rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		color: var(--dash-text-secondary);
		font-size: 0.85rem;
	}
	.cta {
		background: #6f6af8;
		border: 0;
		color: #fff;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.cta:hover {
		background: #807cff;
	}
	.cta-secondary {
		background: rgba(255, 255, 255, 0.08);
	}
	.cta-secondary:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.locked-hint {
		color: var(--dash-text-muted);
		font-style: italic;
		margin: 0;
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
	}

	/* ─── Right rail (FAQ + Recent) ──────────────────────────────────────── */
	.rail {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.rail h5 {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--dash-text-secondary);
	}
	.rail section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.rail-empty {
		margin: 0;
		color: var(--dash-text-muted);
		font-size: 0.85rem;
	}

	@media (max-width: 720px) {
		.page {
			grid-template-columns: 1fr;
			padding: 1.25rem 1rem 3rem;
		}
	}
</style>
