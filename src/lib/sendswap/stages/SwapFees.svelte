<script lang="ts">
	/**
	 * What this swap will actually cost, and what it is guaranteed to deliver.
	 *
	 * This is the panel the redesign brief called "too complicated", and it
	 * was: six terms of AMM jargon — price impact, slippage tolerance,
	 * protocol fee, exchange fee, expected output, minimum received — stated
	 * as bare labels with no explanation anywhere on the screen, plus a
	 * two-paragraph price-impact warning that was ALWAYS in the DOM at
	 * `visibility: hidden` so the panel would not change height.
	 *
	 * What changed:
	 *   - every term carries a (?) that says what it is in one sentence, so
	 *     the screen needs no explainer and no paragraph of its own;
	 *   - the warning is one line that appears when it applies, with the
	 *     long version behind its (?). Its space is reserved by a min-height
	 *     on the row rather than by rendering both messages invisibly;
	 *   - the rows are `ui/StatRow`, the same label·value row the rest of the
	 *     redesign uses, instead of a fourth private dialect of one.
	 *
	 * The numbers are all computed by the caller (ultimately `$lib/calc`);
	 * this only decides how they read.
	 */
	import { TriangleAlert } from '@lucide/svelte';
	import { Hint, Spinner, StatRow } from '$lib/ui';
	import { impactLevel } from '$lib/calc';
	import SlippageControl from './SlippageControl.svelte';

	let {
		slippageBps = $bindable(),
		advanced = false,
		priceImpactPct,
		expectedOutput,
		expectedOutputUsd,
		minAmountOut,
		minAmountOutUsd,
		protocolFeeUsd,
		twoHop = false,
		exchangeFeePct,
		hasQuote,
		poolLoadFailed = false,
		poolLoadingRetry = false,
		onRetry
	}: {
		slippageBps: number;
		/** Advanced reveals the slippage chips. The tolerance in force is
		 *  still reported below either way, so hiding them hides no value. */
		advanced?: boolean;
		priceImpactPct: number;
		/** "12.345 HIVE", already formatted. */
		expectedOutput?: string;
		expectedOutputUsd?: string | null;
		minAmountOut?: string;
		minAmountOutUsd?: string | null;
		protocolFeeUsd?: string | null;
		/** Two-hop routes pay the protocol tier twice. */
		twoHop?: boolean;
		/** null hides the row; 0 renders as "Free". */
		exchangeFeePct?: number | null;
		/** False while there is no quote to show. */
		hasQuote: boolean;
		poolLoadFailed?: boolean;
		poolLoadingRetry?: boolean;
		onRetry?: () => void;
	} = $props();

	/**
	 * Price impact is a cost, so a small one is not good news — it is simply
	 * not bad news. Green on 0.04% read as an endorsement and made the colour
	 * meaningless by the time it mattered, so only "low" and above are
	 * coloured and a negligible impact stays plain.
	 *
	 * Thresholds come from `impactLevel` in calc.ts rather than a second set
	 * written here: the two already disagreed (this said 2% / 10%, calc says
	 * 1% / 3% / 5%), and the warning banner below reads its own third set.
	 */
	const impactTone = $derived.by(() => {
		switch (impactLevel(priceImpactPct)) {
			case 'severe':
			case 'high':
				return 'bad';
			case 'medium':
				return 'warn';
			case 'low':
				return 'plain';
			default:
				return 'muted';
		}
	});
	const warnLevel = $derived(
		priceImpactPct >= 15 ? 'severe' : priceImpactPct >= 10 ? 'high' : 'none'
	);
</script>

<div class="swap-fees">
	<div class="rows">
		<StatRow
			label="Price impact"
			tone={hasQuote && priceImpactPct > 0 ? impactTone : 'muted'}
			hint="How much your own trade moves the pool's price. It grows with the size of the trade relative to the pool, and you pay it as a worse rate."
		>
			{#if hasQuote && priceImpactPct > 0}
				{priceImpactPct.toFixed(2)}%
			{:else}
				&mdash;
			{/if}
		</StatRow>

		{#if advanced}
			<div class="slippage-row">
				<span class="slippage-label">
					Slippage tolerance
					<Hint
						size={14}
						label="About slippage tolerance"
						text="How far the price may move against you between signing and execution before the swap is cancelled instead. Too low and it fails; too high and you can be filled at a worse rate."
					/>
				</span>
				<SlippageControl bind:slippageBps />
			</div>
		{/if}
	</div>

	<!-- One line, only when it applies. The row keeps a min-height so the
	     panel does not jump as the amount is typed. -->
	<div
		class="impact-warning"
		class:severe={warnLevel === 'severe'}
		class:shown={warnLevel !== 'none'}
	>
		{#if warnLevel !== 'none'}
			<TriangleAlert size={14} />
			<span>
				{warnLevel === 'severe' ? 'Very high price impact' : 'High price impact'}
				<Hint
					size={13}
					label="About this warning"
					text={warnLevel === 'severe'
						? 'There is not enough liquidity in this pool for a trade this size, so you would lose a large part of it to price impact. Try a smaller amount.'
						: 'A trade this size moves the pool price noticeably. A smaller amount, or splitting it over time, gets a better rate.'}
				/>
			</span>
		{/if}
	</div>

	{#if hasQuote}
		<div class="fee-details">
			<StatRow
				label="Expected output"
				hint="What you receive at the current pool price, after fees. It is an estimate — the pool can move before your swap executes."
			>
				<span class="stack">
					<span>{expectedOutput}</span>
					{#if expectedOutputUsd}<span class="usd-approx">{expectedOutputUsd}</span>{/if}
				</span>
			</StatRow>

			<StatRow
				label="Protocol fee"
				value={protocolFeeUsd ?? '—'}
				hint={twoHop
					? 'The Magi network charges 0.08% per pool. This route goes through two pools, so 0.16% in total.'
					: 'The Magi network charges 0.08% of the swap. It is already taken out of the expected output above.'}
			/>

			{#if exchangeFeePct != null}
				<StatRow
					label="Exchange fee"
					tone={exchangeFeePct === 0 ? 'good' : 'warn'}
					value={exchangeFeePct === 0 ? 'Free' : `${exchangeFeePct}%`}
					hint={exchangeFeePct === 0
						? "Altera's own fee for running the swap. It is currently switched off, so every pair is free."
						: `Altera's own fee for running the swap: ${exchangeFeePct}% of the input, on every pair.`}
				/>
			{/if}

			<StatRow
				label="Min received"
				strong
				hint="The floor your slippage tolerance buys you. If the swap cannot deliver at least this much, it is cancelled on chain and you keep your funds."
			>
				<span class="stack">
					<span>{minAmountOut}</span>
					{#if minAmountOutUsd}<span class="usd-approx">{minAmountOutUsd}</span>{/if}
				</span>
			</StatRow>
		</div>
	{:else if poolLoadFailed || poolLoadingRetry}
		<!-- Loading and failing used to share the amber box and the warning
		     triangle, so waiting a moment looked like something had gone
		     wrong. Only the failure is a warning now. -->
		{#if poolLoadingRetry}
			<div class="pool-loading">
				<Spinner size={14} />
				<span>Loading pool data…</span>
			</div>
		{:else}
			<div class="pool-warning">
				<TriangleAlert size={14} />
				<span>Unable to load pool data.</span>
				<button type="button" class="pool-retry-btn" onclick={() => onRetry?.()}>Retry</button>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.swap-fees {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		background-color: var(--dash-surface);
		overflow: hidden;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem 1rem 0.5rem;
	}

	.slippage-row {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.4rem 0.75rem;
		min-width: 0;
		padding: 3px 0;
	}
	.slippage-label {
		display: inline-flex;
		align-items: center;
		font-size: 13px;
		font-weight: 600;
		color: var(--alt-tx-2, var(--dash-text-muted));
	}

	.impact-warning {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 0;
		padding: 0 1rem;
		color: #d97706;
		font-size: var(--text-sm);
		font-weight: 600;

		&.shown {
			min-height: 2rem;
			padding: 0.375rem 1rem;
			border-top: 1px solid var(--dash-card-border);
		}
		&.severe {
			color: var(--dash-accent-red, #ff6b6b);
		}
		:global(svg) {
			flex-shrink: 0;
		}
		span {
			display: inline-flex;
			align-items: center;
			min-width: 0;
		}
	}

	.fee-details {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
	.stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.usd-approx {
		font-size: var(--text-xs);
		font-weight: 400;
		color: var(--dash-text-muted);
	}

	.pool-loading {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: var(--text-sm);
		color: var(--dash-text-muted);
		margin: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	.pool-warning {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: var(--text-sm);
		color: #f59e0b;
		margin: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(245, 158, 11, 0.25);
		border-radius: 12px;
		background: rgba(245, 158, 11, 0.06);
	}
	.pool-retry-btn {
		padding: 0.2rem 0.6rem;
		border: 1px solid rgba(111, 106, 248, 0.35);
		border-radius: 12px;
		background: transparent;
		color: var(--dash-text-secondary);
		font: inherit;
		font-size: var(--text-xs);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
		&:hover {
			background: rgba(111, 106, 248, 0.15);
			color: var(--dash-text-primary);
			border-color: var(--dash-accent-purple);
		}
	}

	@media (max-width: 420px) {
		.rows,
		.fee-details {
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}
		.slippage-row {
			/* The chips need the full width once the label is on its own line. */
			align-items: flex-start;
		}
	}
</style>
