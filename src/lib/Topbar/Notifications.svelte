<!--
	Notification bell.

	Rows come from two places:
	  - locally, when a transaction row on the transactions page flips status
	    (Tr.svelte → addNotification), and
	  - the polled feed ($lib/Topbar/notificationFeed), which reconciles the
	    bell against the chain: the signed-in account's transactions, scheduled
	    contract updates (plus the ones that activated since your last visit),
	    and — for accounts holding consensus stake — open governance proposals.

	Both write into the same store keyed by id, so a row the feed already knows
	about is never duplicated by the page-local source.
-->
<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Popover from '$lib/zag/Popover.svelte';
	import {
		Bell,
		ChevronLeft,
		ChevronRight,
		Landmark,
		Receipt,
		ShieldAlert,
		Trash2
	} from '@lucide/svelte';
	import moment from 'moment';
	import { onMount, untrack } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		getLocalNotifications,
		notificationKind,
		notifications,
		notificationUpdateIndicator,
		removeNotification,
		setLocalNotifications,
		type ContractUpdateNotification,
		type GovernanceNotification,
		type Notification,
		type TxNotification
	} from './notifications';
	import { syncNotificationFeed } from './notificationFeed';
	import { formatOpType } from '$lib/stores/txStores';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import { getAuth } from '$lib/auth/store';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';

	/** Matches the witness page's contract-updates poll. Fast enough that a
	 *  testnet timelock (~90s) is still caught inside its window. */
	const POLL_MS = 30_000;

	/** Rows in the initial peek, before "Show more" switches to the paged view.
	 *  A constant, not a function of the store: deriving it at init read the
	 *  store before onMount had loaded it, so a fresh page load rendered an
	 *  empty list until the bell was clicked. */
	const PREVIEW_SIZE = 5;
	/** Rows per page once the list is paged. */
	const ROWS_PER_PAGE = 10;

	onMount(() => {
		notifications.set(getLocalNotifications());
		// Subscribing here (rather than at module scope) does double duty: the
		// immediate first callback sorts the rows we just loaded — otherwise
		// stored notifications stay invisible until something else happens to
		// bump the indicator — and the unsubscribe is tied to the component.
		return notificationUpdateIndicator.subscribe(() => {
			updateAndSort();
		});
	});

	// The bell lives in the topbar, inside the authed layout that provides the
	// auth context — but stay defensive so rendering it bare (tests, storybook)
	// doesn't throw on a missing context.
	const authFn = getAuth();
	let auth = $derived(authFn?.());
	let did = $derived(auth?.value?.did);
	let username = $derived(auth?.value?.username);
	// "Is this account a witness" == it holds consensus stake. Read off the
	// balance the topbar already polls, so no extra query.
	let consensusStake = $derived($accountBalance.bal?.hive_consensus ?? 0);

	$effect(() => {
		// Re-armed whenever the signed-in account (or its witness status)
		// changes, so the feed always polls for the current user.
		const opts = { consensusStake, did, username };
		let inFlight = false;
		const run = () => {
			if (inFlight) return;
			inFlight = true;
			syncNotificationFeed(opts).finally(() => {
				inFlight = false;
			});
		};
		run();
		const handle = setInterval(run, POLL_MS);
		return () => clearInterval(handle);
	});

	let sortedNotifications: [string, Notification][] = $state([]);

	let anyUnread = $state(false);

	function checkForUnread() {
		anyUnread = $notifications
			.entries()
			.toArray()
			.some(([_, tx]) => !tx.read);
	}

	function updateAndSort() {
		sortedNotifications = $notifications
			.entries()
			.toArray()
			.sort((a, b) => {
				const timeA = new Date(a[1].timestamp).getTime();
				const timeB = new Date(b[1].timestamp).getTime();
				return timeB - timeA;
			});
		checkForUnread();
	}

	// The panel opens as a short peek. "Show more" turns it into a paged list
	// over everything the feed holds — the whole set is already in memory, so
	// paging is a slice, not a fetch.
	let paged = $state(false);
	let pageIndex = $state(0);

	const pageCount = $derived(Math.max(1, Math.ceil(sortedNotifications.length / ROWS_PER_PAGE)));
	/** Deleting rows can strand `pageIndex` past the end; clamp for display
	 *  rather than writing back to state (which would fight the user's click). */
	const currentPage = $derived(Math.min(pageIndex, pageCount - 1));
	const visibleNotifications = $derived(
		paged
			? sortedNotifications.slice(
					currentPage * ROWS_PER_PAGE,
					currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE
				)
			: sortedNotifications.slice(0, PREVIEW_SIZE)
	);

	function showMore() {
		paged = true;
		pageIndex = 0;
	}

	/**
	 * Page numbers to render: always the first and last, plus a window around
	 * the current one, with `null` marking an elided run. Keeps the strip
	 * inside the popover's width however many pages there are.
	 */
	function pageStrip(current: number, count: number): (number | null)[] {
		const wanted = [0, count - 1, current - 1, current, current + 1]
			.filter((p) => p >= 0 && p < count)
			.sort((a, b) => a - b);
		const out: (number | null)[] = [];
		let prev: number | null = null;
		for (const p of wanted) {
			if (prev === p) continue;
			if (prev !== null && p - prev > 1) out.push(null);
			out.push(p);
			prev = p;
		}
		return out;
	}
	/**
	 * Closing the panel marks everything in it read, which is what clears the
	 * bell's dot.
	 *
	 * Two things this must NOT do. It must not mark only the first `length`
	 * rows: the list is scrollable and the feed routinely holds a dozen rows,
	 * so anything below the fold stayed unread and the dot never went out. And
	 * it must not run on mount — this effect also fires once with `open` false
	 * at startup, which would consume the unread state of a contract update
	 * queued while you were away before you ever saw it.
	 */
	let hasOpened = false;
	$effect(() => {
		if (!open) {
			if (!hasOpened) return;
			untrack(() => {
				for (const ntf of $notifications.values()) {
					ntf.read = true;
				}
				setLocalNotifications($notifications);
				checkForUnread();
			});
			return;
		}
		hasOpened = true;
		untrack(() => {
			updateAndSort();
		});
	});

	let open: boolean = $state(false);

	const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

	/** Curated/on-chain contract name when we have one, else the short id. */
	const contractLabel = (ntf: ContractUpdateNotification) =>
		ntf.name?.trim() || `contract ${shortId(ntf.contractId)}`;

	/** Contracts are DIDs too, but "@vsc1B…" reads wrong — label them plainly. */
	function accountLabel(did: string): string {
		return did.startsWith('contract:')
			? `contract ${getAccountNameFromDid(did)}`
			: `@${getAccountNameFromDid(did)}`;
	}

	const coinFromAsset = (asset: string) =>
		Coin[asset.split('_')[0] as keyof typeof Coin] || Coin.unk;

	/** Signed settled amount, e.g. "+6.080 HIVE". Only present once a tx has a
	 *  ledger effect for us, so nothing is shown for a pending or failed one. */
	function amountLabel(ntf: TxNotification): string | undefined {
		if (typeof ntf.amount !== 'number' || !ntf.asset) return undefined;
		const pretty = new CoinAmount(ntf.amount, coinFromAsset(ntf.asset), true).toPrettyString();
		return `${'to' in ntf ? '−' : '+'}${pretty}`;
	}

	const proposalLabel = (ntf: GovernanceNotification) =>
		ntf.proposalType === 'reserve_payout'
			? 'Reserve payout'
			: ntf.proposalType === 'slash_restore'
				? 'Slash restore'
				: formatOpType(ntf.proposalType);
</script>

{#snippet txRow(ntf: TxNotification, id: string, close: () => void)}
	{@const fromYou = 'to' in ntf}
	{@const counterparty = fromYou ? ntf.to : ntf.from}
	{@const amount = amountLabel(ntf)}
	<!-- The transactions page opens ?tx=&index= on exactly this row: it pages
	     backwards until the tx loads, scrolls to it and opens its detail. -->
	<a class="notif-link" href={`/transactions?tx=${id}&index=${ntf.opIndex ?? 0}`} onclick={close}>
		<span class="notif-text">
			{formatOpType(ntf.type)}
			{#if counterparty}
				{fromYou ? 'to' : 'from'}
				<strong>{accountLabel(counterparty)}</strong>
			{/if}
			· {ntf.status.toLowerCase()}
		</span>
	</a>
	{#if amount}
		<span class="notif-sub">{amount}</span>
	{/if}
{/snippet}

{#snippet contractUpdateRow(ntf: ContractUpdateNotification, close: () => void)}
	<a
		class="notif-link"
		href={`/witness-assistant/contract-update/${ntf.contractId}`}
		onclick={close}
	>
		<span class="notif-text">
			Contract update · <strong>{contractLabel(ntf)}</strong>
		</span>
	</a>
	<span class="notif-sub">
		{#if ntf.state === 'pending'}
			activates {moment(ntf.activationTs).fromNow()} · block #{ntf.activationHeight.toLocaleString()}
		{:else}
			went live at block #{ntf.activationHeight.toLocaleString()}
		{/if}
		{#if ntf.proposer}
			· by <strong>@{getAccountNameFromDid(ntf.proposer)}</strong>
		{/if}
	</span>
{/snippet}

{#snippet governanceRow(ntf: GovernanceNotification, close: () => void)}
	<a class="notif-link" href="/witness-assistant" onclick={close}>
		<span class="notif-text">
			{proposalLabel(ntf)}
			{#if ntf.subject}
				· <strong>@{getAccountNameFromDid(ntf.subject)}</strong>
			{/if}
			{#if ntf.amount}
				· {new CoinAmount(ntf.amount, Coin.hive, true).toPrettyString()}
			{/if}
		</span>
	</a>
	<span class="notif-sub">
		{#if ntf.status === 'open'}
			{ntf.voted ? 'open · you voted' : 'open · needs your vote'}
		{:else}
			{ntf.status}
		{/if}
	</span>
{/snippet}

{#snippet notificationSnippet(ntf: Notification, id: string, close: () => void)}
	{@const kind = notificationKind(ntf)}
	<div class="notif">
		<span class="notif-dot" class:filled={!ntf.read}></span>
		<span class="notif-icon kind-{kind}">
			{#if kind === 'contract-update'}
				<ShieldAlert size={13} />
			{:else if kind === 'governance'}
				<Landmark size={13} />
			{:else}
				<Receipt size={13} />
			{/if}
		</span>
		<div class="notif-body">
			{#if kind === 'contract-update'}
				{@render contractUpdateRow(ntf as ContractUpdateNotification, close)}
			{:else if kind === 'governance'}
				{@render governanceRow(ntf as GovernanceNotification, close)}
			{:else}
				{@render txRow(ntf as TxNotification, id, close)}
			{/if}
			<span class="notif-time">{moment(ntf.timestamp).format('MMM DD · H:mm')}</span>
		</div>
		<span class="notif-delete">
			<PillButton
				onclick={() => {
					removeNotification(id);
					updateAndSort();
				}}
				styleType="icon-subtle"
			>
				<Trash2 size={14} />
			</PillButton>
		</span>
	</div>
{/snippet}

{#snippet pager()}
	<nav class="pager" aria-label="Notification pages">
		<button
			class="page-step"
			disabled={currentPage === 0}
			aria-label="Previous page"
			onclick={() => (pageIndex = Math.max(0, currentPage - 1))}
		>
			<ChevronLeft size={14} />
		</button>
		{#each pageStrip(currentPage, pageCount) as p}
			{#if p === null}
				<span class="page-gap">…</span>
			{:else}
				<button
					class="page-num"
					class:current={p === currentPage}
					aria-current={p === currentPage ? 'page' : undefined}
					aria-label={`Page ${p + 1}`}
					onclick={() => (pageIndex = p)}
				>
					{p + 1}
				</button>
			{/if}
		{/each}
		<button
			class="page-step"
			disabled={currentPage >= pageCount - 1}
			aria-label="Next page"
			onclick={() => (pageIndex = Math.min(pageCount - 1, currentPage + 1))}
		>
			<ChevronRight size={14} />
		</button>
	</nav>
{/snippet}

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton
		{...attributes}
		aria-label="Notifications"
		onclick={(e) => {
			//每 open starts as a peek again.
			paged = false;
			pageIndex = 0;
			attributes.onclick!(e);
		}}
		styleType="icon"
	>
		<Bell />
		{#if anyUnread}
			<span class="unread trigger"></span>
		{/if}
	</PillButton>
{/snippet}

<Popover {trigger} title="Notifications" bind:open>
	{#snippet children(close)}
		{#key sortedNotifications}
			{#if $notifications.size === 0}
				No notifications currently.
			{:else}
				{@const showPager = paged && pageCount > 1}
				{#if showPager}{@render pager()}{/if}
				<!-- Rows carry a sub-line now, so a full page of them is taller than
				     the viewport. Scroll inside the popover rather than running off
				     the bottom of the screen. -->
				<div class="notif-scroll">
					<table>
						<tbody>
							{#each visibleNotifications as [id, notification] (id)}
								<tr>
									<td>{@render notificationSnippet(notification, id, close)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if showPager}{@render pager()}{/if}
				{#if !paged && sortedNotifications.length > PREVIEW_SIZE}
					<div class="more-button">
						<PillButton onclick={showMore} styleType="text-subtle">
							<span class="sm-caption">Show more</span>
						</PillButton>
					</div>
				{/if}
			{/if}
		{/key}
	{/snippet}
</Popover>

<style lang="scss">
	.notif {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.1rem 0.15rem;
		.notif-dot {
			flex-shrink: 0;
			width: 0.4rem;
			height: 0.4rem;
			border-radius: 50%;
			margin-top: 0.4rem;
			background: transparent;
			&.filled {
				background: var(--dash-accent-red);
			}
		}
		/* Kind marker: the three sources read very differently, and a leading
		   icon lets the eye group them without a heading per section. */
		.notif-icon {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.35rem;
			height: 1.35rem;
			border-radius: 50%;
			margin-top: 0.05rem;
			background: rgba(255, 255, 255, 0.06);
			color: var(--dash-text-secondary);
			&.kind-contract-update {
				color: var(--dash-accent-purple);
			}
			&.kind-governance {
				color: var(--dash-accent-blue, var(--dash-accent-purple));
			}
		}
		.notif-body {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 0.1rem;
		}
		.notif-text {
			font-size: 0.82rem;
			line-height: 1.35;
			color: var(--dash-text-primary);
			:global(strong) {
				font-weight: 600;
			}
		}
		.notif-link {
			color: inherit;
			text-decoration: none;
			&:hover .notif-text {
				text-decoration: underline;
			}
		}
		.notif-sub {
			font-size: 0.72rem;
			line-height: 1.35;
			color: var(--dash-text-secondary);
			:global(strong) {
				font-weight: 600;
			}
		}
		.notif-time {
			font-size: 0.7rem;
			color: var(--dash-text-muted);
		}
		.notif-delete {
			flex-shrink: 0;
			:global(svg) {
				color: var(--dash-accent-red);
			}
		}
	}
	tr {
		border-bottom: 1px solid var(--dash-divider);
	}
	tr:last-child {
		border-bottom: none;
	}
	td {
		padding: 0.55rem 0;
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		padding: 0.35rem 0;
		/* Above the list it sits under the popover title, below it under the
		   last row — a hairline on the facing edge keeps both readable. */
		&:first-of-type {
			border-bottom: 1px solid var(--dash-divider);
			margin-bottom: 0.35rem;
		}
		&:last-of-type {
			border-top: 1px solid var(--dash-divider);
			margin-top: 0.35rem;
		}
	}
	.page-num,
	.page-step {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.5rem;
		padding: 0 0.3rem;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--dash-text-secondary);
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;
		&:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.08);
			color: var(--dash-text-primary);
		}
		&:disabled {
			opacity: 0.35;
			cursor: default;
		}
	}
	.page-num.current {
		background: var(--dash-accent-purple);
		border-color: var(--dash-accent-purple);
		color: #fff;
		font-weight: 600;
	}
	.page-gap {
		color: var(--dash-text-muted);
		font-size: 0.72rem;
		padding: 0 0.1rem;
	}

	.notif-scroll {
		max-height: min(60vh, 30rem);
		overflow-y: auto;
		/* Keep the scrollbar off the row content. */
		padding-right: 0.15rem;
		margin-right: -0.15rem;
	}
	.more-button {
		padding-top: 0.5rem;
	}
	.unread {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--dash-accent-red);
	}
	.trigger.unread {
		position: absolute;
		top: 0.125rem;
		right: 0.125rem;
	}
</style>
