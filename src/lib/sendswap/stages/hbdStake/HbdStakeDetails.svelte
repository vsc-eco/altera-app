<!--
	sHBD stake/unstake — production timeline.

	Adopts the DepositTimeline design language (numbered vertical timeline,
	full-row choice cards, step indicators) so /stake reads like /deposit and
	/withdraw. The old StakeHBDModal's "deposit first" checkbox becomes a
	proper "From" step: staking from your Magi balance vs. depositing from
	Hive Mainnet first — the same source concept the deposit flow uses.
-->
<script lang="ts">
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { getAuth } from '$lib/auth/store';
	import { page } from '$app/state';
	import { untrack, type ComponentProps } from 'svelte';
	import { Check, Clock, Info, Receipt } from '@lucide/svelte';
	import Username from '$lib/auth/Username.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { useHbdStakeState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { sHbdAprStore } from '$lib/stores/aprStore';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import type NavButtons from '$lib/sendswap/components/NavButtons.svelte';

	// onHomePage / customButtons MUST stay $bindable — StepsMachine binds them to
	// every stage to drive the footer nav.
	let {
		editStage = () => {},
		isActive = false,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage?: (complete: boolean) => void;
		isActive?: boolean;
		onHomePage?: boolean;
		customButtons?: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	const stakeState = useHbdStakeState();
	const auth = $derived(getAuth()());
	const username = $derived(getUsernameFromAuth(auth));

	// ─── Step machine (Zag) — drives the timeline indicators ─────────────────
	const stepDefs = [
		{ id: 'action', label: 'I want to' },
		{ id: 'from', label: 'From' },
		{ id: 'amount', label: 'Amount' }
	] as const;

	const stepId = $props.id();
	const stepsService = useMachine(steps.machine, {
		id: stepId,
		orientation: 'vertical',
		count: stepDefs.length,
		linear: true
	});
	const stepsApi = $derived(steps.connect(stepsService, normalizeProps));

	// ─── Action cards (step 1) ────────────────────────────────────────────────
	const aprLabel = $derived($sHbdAprStore !== null ? `${$sHbdAprStore}%` : '~12%');
	type ActionDef = {
		value: 'stake' | 'unstake';
		label: string;
		icon: string;
		eta: string;
		fee: string;
		blurb: string;
	};
	const ACTIONS: ActionDef[] = $derived([
		{
			value: 'stake',
			label: 'Stake HBD',
			icon: '/hive/hbd.svg',
			eta: 'earning starts immediately',
			fee: 'no fee',
			blurb: `Move HBD into sHBD savings — it stays transferable while earning ${aprLabel} APR.`
		},
		{
			value: 'unstake',
			label: 'Unstake HBD',
			icon: '/hive/hbd.svg',
			eta: 'available in ~3 days',
			fee: 'no fee',
			blurb: 'Return sHBD to your liquid HBD balance after a ~3 day unbonding period.'
		}
	]);

	// ─── From cards (step 2) ──────────────────────────────────────────────────
	// The old modal's "First deposit HBD into VSC" checkbox, reframed as the
	// same "From" source step the deposit flow has. Hive-Mainnet-first is only
	// possible for Hive wallets (EVM wallets have no L1 HBD to deposit).
	type FromDef = {
		value: 'magi' | 'hive_mainnet' | 'savings';
		label: string;
		icon: string;
		eta: string;
		fee: string;
		blurb: string;
	};
	const STAKE_SOURCES: FromDef[] = [
		{
			value: 'magi',
			label: 'Magi balance',
			icon: '/magi.svg',
			eta: 'instant',
			fee: 'no fee',
			blurb: 'Stake HBD you already hold on your Magi account.'
		},
		{
			value: 'hive_mainnet',
			label: 'Hive Mainnet',
			icon: '/hive/hive.svg',
			eta: 'instant',
			fee: 'no fee',
			blurb: 'Deposit HBD from your Hive wallet first, then stake it — one signature.'
		}
	];
	const UNSTAKE_SOURCE: FromDef = {
		value: 'savings',
		label: 'Staked sHBD',
		icon: '/hive/hbd.svg',
		eta: 'available in ~3 days',
		fee: 'no fee',
		blurb: 'Your sHBD savings balance.'
	};

	const availableSources = $derived.by((): FromDef[] => {
		if (!selectedAction) return [];
		if (selectedAction === 'unstake') return [UNSTAKE_SOURCE];
		// EVM/BTC wallets can only stake from the Magi balance.
		return auth.value?.provider === 'aioha' ? STAKE_SOURCES : [STAKE_SOURCES[0]];
	});

	// ─── Selections ───────────────────────────────────────────────────────────
	// Deep link (?mode=stake|unstake) preselects step 1; otherwise the user
	// chooses explicitly, exactly like the deposit flow's asset step.
	const urlMode = page.url.searchParams.get('mode');
	const initialAction: 'stake' | 'unstake' | null =
		urlMode === 'unstake' ? 'unstake' : urlMode === 'stake' ? 'stake' : null;
	let selectedAction = $state<'stake' | 'unstake' | null>(initialAction);
	let selectedFrom = $state<FromDef['value'] | null>(null);

	function pickAction(value: 'stake' | 'unstake') {
		selectedAction = value;
		stakeState.mode = value;
		amount = new CoinAmount(0, Coin.unk);
		// Unstaking always draws from sHBD savings — auto-advance past "From".
		selectedFrom = value === 'unstake' ? 'savings' : null;
		syncShouldDeposit();
	}
	function pickFrom(value: FromDef['value']) {
		selectedFrom = value;
		syncShouldDeposit();
	}
	function syncShouldDeposit() {
		stakeState.shouldDeposit = selectedFrom === 'hive_mainnet';
	}
	// Apply a deep-linked action once at mount (state writes inside untrack —
	// this is init, not reaction).
	if (initialAction) untrack(() => pickAction(initialAction));

	// RadioGroup binds string values; route them through pickAction / pickFrom.
	let actionRadio = $state<string | null>(initialAction);
	$effect(() => {
		if (actionRadio && actionRadio !== selectedAction) {
			untrack(() => pickAction(actionRadio as 'stake' | 'unstake'));
		}
	});
	let fromRadio = $state<string | null>(null);
	$effect(() => {
		if (fromRadio && fromRadio !== selectedFrom) {
			untrack(() => pickFrom(fromRadio as FromDef['value']));
		}
	});
	// Keep the radio visuals in sync when selections change programmatically
	// (deep link, unstake auto-pick).
	$effect(() => {
		if (selectedFrom !== fromRadio) fromRadio = selectedFrom;
	});

	// Drive the step indicator state from selections.
	$effect(() => {
		if (selectedAction && selectedFrom) stepsApi.setStep(2);
		else if (selectedAction) stepsApi.setStep(1);
		else stepsApi.setStep(0);
	});

	// ─── Amount + recipient (step 3) ──────────────────────────────────────────
	// Recipient defaults to the signed-in account but stays editable — sHBD can
	// legitimately be staked to another account (it lands in their savings).
	let recipient = $state<string | undefined>(undefined);
	$effect(() => {
		if (recipient === undefined && username) recipient = username;
	});
	$effect(() => {
		stakeState.toUsername = recipient ?? '';
	});

	let amount: CoinAmount<Coin> = $state(new CoinAmount(0, Coin.unk));
	$effect(() => {
		stakeState.fromAmount = amount.toAmountString();
	});

	// Same max rules as the old modal: stake from Hive Mainnet → account+bridge
	// balance, stake from Magi → VSC balance, unstake → staked (savings) balance.
	let maxAmount = $derived.by(() => {
		const raw =
			stakeState.mode === 'stake'
				? stakeState.shouldDeposit
					? $accountBalance.connectedBal?.hbd
					: $accountBalance.bal.hbd
				: $accountBalance.bal.hbd_savings;
		return new CoinAmount(raw ?? Number.MAX_SAFE_INTEGER, Coin.hbd, true);
	});

	let hbdOpt = $derived.by(() => {
		return [
			{ coin: Coin.hbd, network: stakeState.shouldDeposit ? Network.hiveMainnet : Network.magi }
		];
	});

	// Report validity to the steps machine only while active, so we don't clobber
	// the review stage's completeness flag.
	$effect(() => {
		if (!isActive) return;
		const amt = amount.amount;
		editStage(
			!!selectedAction &&
				!!selectedFrom &&
				amt > 0 &&
				amt <= maxAmount.amount &&
				!!(recipient ?? '').trim()
		);
	});
</script>

<!-- Choice-card snippets — one per option (RadioGroup snippet contract). -->
{#snippet stakeCard()}{@render choiceCardLayout(ACTIONS[0])}{/snippet}
{#snippet unstakeCard()}{@render choiceCardLayout(ACTIONS[1])}{/snippet}
{#snippet magiSourceCard()}{@render choiceCardLayout(STAKE_SOURCES[0])}{/snippet}
{#snippet hiveMainnetSourceCard()}{@render choiceCardLayout(STAKE_SOURCES[1])}{/snippet}
{#snippet savingsSourceCard()}{@render choiceCardLayout(UNSTAKE_SOURCE)}{/snippet}

{#snippet choiceCardLayout(def: ActionDef | FromDef)}
	<div class="source-card">
		<div class="source-icon">
			<img src={def.icon} alt={def.label} width="28" height="28" />
		</div>
		<div class="source-body">
			<div class="source-head">
				<span class="source-label">{def.label}</span>
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
			<h2>Staking</h2>
			<p class="lead">Stake HBD to earn {aprLabel} APR, or unstake it back to your balance.</p>
		</header>

		<!-- Timeline (Zag steps machine drives indicator state only) -->
		<div {...stepsApi.getRootProps()} class="timeline">
			<!-- ─── Step 1: Action ───────────────────────────────────────────── -->
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
					<div class="step-body card-picker">
						<RadioGroup
							items={[
								{ value: 'stake', snippet: stakeCard },
								{ value: 'unstake', snippet: unstakeCard }
							]}
							bind:value={actionRadio}
						/>
					</div>
				</div>
			</div>

			<!-- ─── Step 2: From ─────────────────────────────────────────────── -->
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
					<div class="step-body card-picker">
						{#if availableSources.length === 0}
							<p class="picker-empty">Pick an action first.</p>
						{:else}
							<!-- `required` also makes RadioGroup auto-select when only one
							     option exists — unstake (Staked sHBD) and EVM stake (Magi
							     balance) are forced rather than needing a dead click. -->
							<RadioGroup
								items={availableSources.map((s) => ({
									value: s.value,
									snippet:
										s.value === 'magi'
											? magiSourceCard
											: s.value === 'hive_mainnet'
												? hiveMainnetSourceCard
												: savingsSourceCard
								}))}
								bind:value={fromRadio}
								required
							/>
						{/if}
					</div>
				</div>
			</div>

			<!-- ─── Step 3: Amount ───────────────────────────────────────────── -->
			<div {...stepsApi.getItemProps({ index: 2 })} class="timeline-item">
				<div {...stepsApi.getIndicatorProps({ index: 2 })} class="timeline-indicator">
					{#if stepsApi.value > 2}
						<Check size={14} strokeWidth={3} />
					{:else}
						3
					{/if}
				</div>
				<div class="timeline-content">
					<h4 class="step-heading">{stepDefs[2].label}</h4>
					<div class="step-body">
						{#if selectedAction && selectedFrom}
							<div class="amount-form">
								<div class="section">
									<Username
										label="Recipient"
										id="hbd-stake-recipient"
										bind:value={recipient}
										required
									/>
								</div>
								<div class="section">
									<label for="hbd-stake-amount">
										{selectedAction === 'stake'
											? stakeState.shouldDeposit
												? 'Deposit and stake'
												: 'Stake'
											: 'Unstake'} amount
									</label>
									<!-- AmountInput positions its conversion/error text absolutely
									     below the field; the fixed-height wrapper reserves that
									     space (same fix as the deposit flow). -->
									<div class="amount-input">
										<AmountInput coinOpts={hbdOpt} bind:coinAmount={amount} {maxAmount} />
									</div>
								</div>
								{#if selectedAction === 'unstake'}
									<p class="unbond-note">
										<b>Note:</b> unstaked HBD is made available after about three days.
									</p>
								{/if}
							</div>
						{:else}
							<p class="locked-hint">Choose the steps above to continue.</p>
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
		/* Inset so the active step indicator's glow ring isn't clipped. */
		padding: 0.5rem 0.75rem;
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

	/* ─── Timeline (mirrors DepositTimeline) ─────────────────────────────── */
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
	.picker-empty,
	.locked-hint {
		margin: 0;
		color: var(--dash-text-muted);
		font-size: 0.9rem;
	}

	/* ─── Choice cards (RadioGroup overrides, same as DepositTimeline) ────── */
	.card-picker :global([data-scope='radio-group'][data-part='root']) :global(.items) {
		flex-direction: column;
		gap: 0.6rem;
	}
	.card-picker :global([data-scope='radio-group'][data-part='root']) :global(.items) > :global(*) {
		width: 100%;
		min-width: 0;
	}
	.card-picker :global([data-scope='radio-group'][data-part='item']) {
		padding: 1.1rem 1.25rem;
		height: auto; /* cards size to content, not RadioGroup's 2.5rem default */
		border-radius: 14px;
		border: 1px solid $border;
		transition:
			background-color 150ms ease,
			border-color 150ms ease;
	}
	.card-picker :global([data-scope='radio-group'][data-part='item']:hover) {
		background: $surface;
		border-color: $border-strong;
	}
	.card-picker :global([data-scope='radio-group'][data-part='item'][data-state='checked']) {
		background: $accent-soft;
		border-color: $accent;
	}

	:global(.source-card) {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.85rem;
		align-items: start;
		width: 100%;
	}
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

	/* ─── Step 3: amount form ────────────────────────────────────────────── */
	.amount-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 26rem;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	/* Reserve room for AmountInput's absolutely-positioned conversion/error
	   text so it can't overlap the content below (mirrors HiveMainnetDeposit). */
	.amount-input {
		height: 65px;
	}
	.unbond-note {
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
		color: var(--dash-text-secondary);
	}
	.unbond-note b {
		color: var(--dash-accent-red);
		font-weight: 500;
	}
</style>
