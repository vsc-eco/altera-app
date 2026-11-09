<script lang="ts">
	import { untrack } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Popover from '$lib/zag/Popover.svelte';
	import { loadFailureReason, type FailureReason, type OutputRef } from './tr/failureReason';

	type Props = {
		status: string;
		compact?: boolean;
		/** The transaction this badge reports on. Passing it (with the
		 *  operation's index) turns a `failed` badge into a button that reveals
		 *  the on-chain error on hover or click, instead of sending the user to
		 *  a block explorer to find out what went wrong. */
		tx?: { id: string; output?: readonly (OutputRef | null | undefined)[] | null } | null;
		opIndex?: number;
	};
	let { status: rawStatus, compact = false, tx = null, opIndex = 0 }: Props = $props();
	const status = $derived.by(() => {
		if (rawStatus == 'INCLUDED') {
			return 'unconfirmed';
		}
		return rawStatus.toLowerCase();
	});

	const badgeClass = $derived({
		badge: true,
		secondary: status == 'failed',
		primary: status == 'confirmed',
		neutral: !['failed', 'confirmed'].includes(status),
		compact
	});

	/** A failure is only explainable when the chain produced a contract output
	 *  for it — that DAG node is where the error message lives. Without one
	 *  there is nothing to reveal, so the badge stays a plain, inert span. */
	const explainable = $derived(status === 'failed' && !!tx?.id && (tx.output?.length ?? 0) > 0);

	let open = $state(false);
	let loadState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let reason = $state<FailureReason | null>(null);

	/** Fetched on first reveal rather than on render: most rows are never
	 *  opened, and a page of the table can hold several failed ones. */
	function ensureReason() {
		if (loadState !== 'idle' || !tx) return;
		loadState = 'loading';
		loadFailureReason(tx.id, tx.output, opIndex)
			.then((found) => {
				reason = found;
				loadState = 'loaded';
			})
			.catch((err) => {
				console.warn('could not load the failure reason for', tx?.id, err);
				loadState = 'error';
			});
	}
	$effect(() => {
		if (open) untrack(ensureReason);
	});
</script>

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<button
		{...attributes}
		type="button"
		class={{ ...badgeClass, explainable: true }}
		aria-label="{status} — show why"
		onclick={(e) => {
			// The whole row is clickable and opens the transaction detail
			// panel; this button has its own job.
			e.stopPropagation();
			attributes.onclick?.(e);
		}}
		onkeydown={(e) => {
			e.stopPropagation();
			attributes.onkeydown?.(e);
		}}
	>
		{status}
	</button>
{/snippet}

{#if explainable}
	<Popover {trigger} hoverable bind:open>
		<div class="reason">
			{#if loadState === 'loaded' && reason}
				<p class="message">{reason.message}</p>
				{#if reason.code && reason.hasMessage}
					<p class="code">{reason.code}</p>
				{/if}
				{#if reason.fromSiblingOp}
					<p class="note">
						Another operation in this transaction failed, so the whole transaction was reverted.
					</p>
				{/if}
			{:else if loadState === 'error'}
				<p class="note">The error couldn't be loaded from the network.</p>
			{:else if loadState === 'loaded'}
				<p class="note">The chain recorded no error message for this transaction.</p>
			{:else}
				<p class="note">Looking up the error…</p>
			{/if}
		</div>
	</Popover>
{:else}
	<span class={badgeClass}>{status}</span>
{/if}

<style>
	.badge {
		color: var(--fg-accent);
		border: 1px solid var(--fg-accent);
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		width: max-content;
		display: inline-flex;
		height: 1.25rem;
		align-items: center;
	}
	.badge.compact {
		font-size: 0.7rem;
		padding: 0.1rem 0.35rem;
		height: auto;
		border-radius: 0.35rem;
	}
	/* The interactive variant looks identical to the span until it is hovered
	   or focused — same pill, plus a cue that there's more to read. */
	button.badge {
		background: none;
		font: inherit;
		line-height: inherit;
		cursor: help;
		transition: background-color 130ms ease;
	}
	button.badge:hover,
	button.badge:focus-visible {
		background-color: var(--bg-accent);
	}

	.reason {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-width: 18rem;
	}
	.reason p {
		margin: 0;
	}
	.message {
		/* Chain messages are machine-written: keep a long one inside the
		   popover instead of letting it blow out sideways. */
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		color: var(--dash-text-muted);
	}
	.note {
		color: var(--dash-text-muted);
	}
</style>
