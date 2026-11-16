<script lang="ts">
	/**
	 * One side of the swap card: "You pay" or "You receive".
	 *
	 * The two panels were written out twice in SwapOptions, 60 lines each and
	 * 95% identical — same header, same amount row, same token button, same
	 * USD line, differing only in their labels and their data sources. Which
	 * meant every change to the shape had to be made twice and, twice, was
	 * not: the two sides drifted on their network pill and on which inline
	 * errors they showed.
	 *
	 * The behaviour stays in the host. This takes the amount input and the
	 * error line as snippets, because those are wired to the swap state
	 * machine and have no business moving.
	 */
	import type { Snippet } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { Hint } from '$lib/ui';

	let {
		label,
		hint,
		networkLabel,
		external = false,
		balance,
		coinIcon,
		coinLabel,
		onPickToken,
		usd,
		priceUnavailable = false,
		amount,
		errors
	}: {
		/** "You pay" / "You receive". */
		label: string;
		/** One sentence behind a (?) after the label. */
		hint?: string;
		/** Network pill text — MAGI, HIVE MAINNET, BITCOIN… */
		networkLabel?: string;
		/** True for anything that is not Magi, which tints the pill. */
		external?: boolean;
		/** "Balance: 12.345 HIVE", already formatted. Omit on the receive side. */
		balance?: string;
		coinIcon?: string;
		/** The asset's display name, or undefined when nothing is picked. */
		coinLabel?: string;
		onPickToken: () => void;
		/** "≈ $12.34", already formatted; null while unknown. */
		usd?: string | null;
		/** The price feed failed and the user typed an amount. */
		priceUnavailable?: boolean;
		/** The AmountInput, wired by the host. */
		amount: Snippet;
		/** Inline error text for this side. */
		errors?: Snippet;
	} = $props();
</script>

<div class="swap-section">
	<div class="section-header">
		<span class="section-label">
			{label}
			{#if hint}<Hint text={hint} label="About {label}" size={13} />{/if}
		</span>
		<span class="section-header-center">
			{#if networkLabel}
				<span class={['network-pill', { external }]}>{networkLabel}</span>
			{/if}
		</span>
		<span class="section-balance sm-caption">{balance ?? ''}</span>
	</div>

	<div class="section-input-row">
		<div class="input-field">{@render amount()}</div>
		<button class="token-selector-btn" type="button" onclick={onPickToken}>
			{#if coinLabel}
				{#if coinIcon}
					<img src={coinIcon} alt={coinLabel} class="token-icon" />
				{/if}
				<span class="token-name">{coinLabel}</span>
			{:else}
				<span class="token-name">Select</span>
			{/if}
			<ChevronDown size={14} />
		</button>
	</div>

	<div class="section-usd-row">
		<span class="section-usd-approx">
			{#if usd != null}
				{usd}
			{:else if priceUnavailable}
				<span class="price-unavailable">Price unavailable</span>
			{/if}
		</span>
		{#if errors}{@render errors()}{/if}
	</div>
</div>

<style lang="scss">
	.swap-section {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		background-color: var(--dash-swap-field-bg);
		border: 1px solid var(--dash-input-border);
		border-radius: 16px;
		padding: 0.75rem;
	}
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.25rem;
		min-width: 0;
	}
	.section-label {
		display: inline-flex;
		align-items: center;
		flex: 1;
		font-size: 0.8rem;
		color: var(--dash-text-muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	.section-header-center {
		flex: 1;
		display: flex;
		justify-content: center;
		min-width: 0;
	}
	.section-balance {
		flex: 1;
		text-align: right;
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.network-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.45rem;
		border-radius: 1rem;
		border: 1px solid var(--dash-accent-purple);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--dash-accent-purple);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
		&.external {
			border-color: var(--dash-text-secondary);
			color: var(--dash-text-secondary);
		}
	}

	.section-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 3rem;
		min-width: 0;
	}
	.input-field {
		flex: 1;
		min-width: 0;
		--number-input-padding-right: 0;
	}
	/* AmountInput brings its own label, unit icons, border and validation
	   line; inside the swap card the section supplies all of those, so they
	   are turned off rather than duplicated. */
	.input-field :global(.normal-wrapper label) {
		display: none;
	}
	.input-field :global(.normal-wrapper .amount-input) {
		border: none;
		background: transparent;
		padding: 0;
		gap: 0;
	}
	.input-field :global(.normal-wrapper .amount-input > .icons),
	.input-field :global(.normal-wrapper .amount-input > svg) {
		display: none;
	}
	.input-field :global(.normal-wrapper .amount-input [data-part='input']) {
		font-size: 1.5rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		height: auto;
		border: none;
		border-radius: 0;
		padding: 0.5rem 0;
	}
	.input-field :global(.normal-wrapper .amount-input:has(input:focus-visible)) {
		box-shadow: none;
		border-bottom-color: transparent;
		border-radius: 0;
	}
	/* Errors show on the USD row instead, which does not shift the layout. */
	.input-field :global(.normal-wrapper .bottom-info) {
		display: none;
	}

	.token-selector-btn {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: none;
		padding: 0.5rem 0.75rem;
		background-color: var(--dash-surface);
		border: 1px solid var(--dash-card-border);
		border-radius: 2rem;
		cursor: pointer;
		color: var(--dash-text-primary);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		transition: background-color 0.15s ease;
		&:hover {
			background-color: var(--dash-card-border);
		}
		.token-icon {
			width: 1.5rem;
			height: 1.5rem;
			border-radius: 50%;
		}
		.token-name {
			font-weight: 600;
		}
	}

	.section-usd-row {
		display: flex;
		flex-wrap: wrap-reverse;
		justify-content: space-between;
		align-items: center;
		min-height: 1.4em;
		gap: 0.125rem 0.5rem;
		min-width: 0;
	}
	.section-usd-approx {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	.price-unavailable {
		font-size: var(--text-xs);
		color: var(--dash-text-muted);
		font-style: italic;
		font-family: inherit;
	}
	/* The host renders the error text; this styles it from here because the
	   snippet is rendered inside this component's tree. */
	.section-usd-row :global(.section-error-inline) {
		font-size: var(--text-xs);
		color: var(--negative-text, #f87171);
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		margin-left: auto;
		text-align: right;
		overflow-wrap: anywhere;
	}

	/* 390px: the amount and the token button cannot share a row once the
	   amount reaches six figures. */
	@media (max-width: 420px) {
		.section-header {
			flex-wrap: wrap;
		}
		.section-balance {
			flex-basis: 100%;
			text-align: left;
		}
		.token-selector-btn {
			padding: 0.5rem 0.6rem;
			font-size: 0.85rem;
		}
	}
</style>
