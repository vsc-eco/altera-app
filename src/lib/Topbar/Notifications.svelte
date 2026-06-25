<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Popover from '$lib/zag/Popover.svelte';
	import { Bell, Trash2 } from '@lucide/svelte';
	import moment from 'moment';
	import { onMount, untrack } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		getLocalNotifications,
		notifications,
		notificationUpdateIndicator,
		removeNotification,
		setLocalNotifications,
		type Notification
	} from './notifications';
	import { formatOpType } from '$lib/stores/txStores';
	import { getAccountNameFromDid } from '$lib/getAccountName';

	onMount(() => {
		notifications.set(getLocalNotifications());
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

	notificationUpdateIndicator.subscribe(() => {
		updateAndSort();
	});

	let length = $state(Math.min(3, $notifications.size));
	function showMore() {
		length = Math.min(length + 10, $notifications.size);
	}
	$effect(() => {
		if (!open) {
			untrack(() => {
				for (const [id, _] of sortedNotifications.slice(0, length)) {
					if ($notifications.has(id)) {
						$notifications.get(id)!.read = true;
					}
				}
				setLocalNotifications($notifications);
				checkForUnread();
			});
			return;
		}
		length;
		untrack(() => {
			updateAndSort();
		});
	});

	let open: boolean = $state(false);
</script>

{#snippet notificationSnippet(ntf: Notification, id: string)}
	{@const fromYou = 'to' in ntf}
	<div class="notif">
		<span class="notif-dot" class:filled={!ntf.read}></span>
		<div class="notif-body">
			<span class="notif-text">
				{formatOpType(ntf.type)}
				{fromYou ? 'to' : 'from'}
				<strong>@{getAccountNameFromDid(fromYou ? ntf.to : ntf.from)}</strong>
				· {ntf.status.toLowerCase()}
			</span>
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

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton
		{...attributes}
		onclick={(e) => {
			length = Math.min(3, $notifications.size);
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
	{#key sortedNotifications}
		{#if $notifications.size === 0}
			No notifications currently.
		{:else}
			<table>
				<tbody>
					{#each sortedNotifications.slice(0, length) as [id, notification]}
						<tr>
							<td>{@render notificationSnippet(notification, id)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="more-button">
				{#if sortedNotifications.length > length}
					<PillButton onclick={showMore} styleType="text-subtle">
						<span class="sm-caption">Show more</span>
					</PillButton>
				{/if}
			</div>
		{/if}
	{/key}
</Popover>

<style lang="scss">
	.notif {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
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
