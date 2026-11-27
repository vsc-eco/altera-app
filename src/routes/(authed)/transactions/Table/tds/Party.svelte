<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import { sanitizeBidiText } from '$lib';
	import Avatar from '$lib/zag/Avatar.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { MessageSquare } from '@lucide/svelte';

	/**
	 * ONE party of a transaction — the table lists the sender and the
	 * recipient in their own columns, so a row says who paid whom without
	 * being opened. It used to show a single "other" account, which on a row
	 * the viewer neither sent nor received (a contract moving funds between
	 * two other accounts) could only guess.
	 */
	let isHovered = $state(false);
	let {
		account,
		memo,
		/** Shown in place of an unknown party, e.g. a pending row's recipient. */
		placeholder = '\u2014'
	}: { account: string | undefined; memo?: string | undefined; placeholder?: string } = $props();

	const name = $derived(account ? getUsernameFromDid(account) : '');

	// APP-14: strip bidi/control chars from the user-controlled memo.
	let safeMemo = $derived(sanitizeBidiText(memo));
</script>

<td onmouseenter={() => (isHovered = true)} onmouseleave={() => (isHovered = false)}>
	{#if !account}
		<span class="unknown">{placeholder}</span>
	{:else}
	<span class="to-from">
		<span class="pfp">
			<Avatar did={account} fallback="" size={"small"}></Avatar>
		</span>
		<span class="toFrom">
			<BasicCopy value={name} show={isHovered}>
				{name}
				{#snippet trailing()}
					{#if safeMemo}
						<button
							class="memo-indicator"
							type="button"
							aria-label="Memo: {safeMemo}"
						>
							<MessageSquare size={14} aria-hidden="true" />
							<Tooltip>Memo: {safeMemo}</Tooltip>
						</button>
					{/if}
				{/snippet}
			</BasicCopy>
		</span>
	</span>
	{/if}
</td>

<style>
	.unknown {
		color: var(--dash-text-muted);
	}

	td {
		padding-top: 0 !important;
		padding-bottom: 0 !important;
	}
	.to-from {
		width: 100%;
		display: grid;
		grid-template-areas: 'pfp toFrom';
		grid-template-columns: auto minmax(0, 1fr);
		justify-content: left;
		column-gap: 0.25rem;
		align-items: center;
		align-content: center;
		/* `overflow: hidden` would clip the memo tooltip; the grid + .content
		   ellipsis still constrain the cell width without this. */
	}

	.pfp {
		grid-area: pfp;
	}
	.toFrom {
		grid-area: toFrom;
		display: flex;
		align-items: center;
		min-width: 0;
	}
	/* BasicCopy wrapper — allow it to shrink and fill available space */
	.toFrom :global(> span) {
		min-width: 0;
		flex: 1;
		display: flex;
		align-items: center;
	}
	/* The actual text node inside BasicCopy — this is where ellipsis must live */
	.toFrom :global(> span > .content) {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		min-width: 0;
	}

	/* Memo indicator: focusable button → tooltip on hover (desktop) AND on
	   focus (keyboard tab + mobile tap). Reset native button styles so it
	   renders as inline text. */
	.memo-indicator {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: none;
		border: 0;
		padding: 0;
		margin: 0;
		color: var(--dash-text-secondary);
		cursor: default;
		outline-offset: 2px;
	}
	.memo-indicator:hover,
	.memo-indicator:focus,
	.memo-indicator:focus-visible {
		color: var(--dash-text-primary);
	}
	/* Override the shared Tooltip's transition for a snappier reveal. */
	.memo-indicator :global(.tooltip) {
		transition:
			opacity 0.05s ease,
			visibility 0.05s ease;
	}
	.memo-indicator:hover :global(.tooltip),
	.memo-indicator:focus :global(.tooltip),
	.memo-indicator:focus-visible :global(.tooltip) {
		opacity: 1;
		visibility: visible;
	}
</style>
