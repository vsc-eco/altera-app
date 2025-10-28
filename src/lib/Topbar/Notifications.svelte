<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Popover from '$lib/zag/Popover.svelte';
	import { Bell, Trash2 } from '@lucide/svelte';
	import moment from 'moment';
	import { onMount, untrack } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		addNotification,
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
		{formatOpType(ntf.type)}
		{fromYou ? 'to' : 'from'}
		{`@${getAccountNameFromDid(fromYou ? ntf.to : ntf.from)}`}
		completed.
		<span class="at">
			{moment(ntf.timestamp).format('MMM DD H:mm')}
		</span>
		{#if !ntf.read}
			<span class="unread"></span>
		{/if}
		<span class="delete">
			<PillButton
				onclick={() => {
					removeNotification(id);
					updateAndSort();
				}}
				styleType="icon-subtle"
			>
				<Trash2 />
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
		position: relative;
		padding-top: 1.5rem;
		display: flex;
		align-items: center;
		.at {
			position: absolute;
			top: 0;
			right: 0;
			font-size: var(--text-sm);
			color: var(--neutral-fg-mid);
		}
		.delete {
			margin-left: auto;
			padding-left: 0.5rem;
			:global(svg) {
				color: var(--secondary-mid);
			}
		}
		.unread {
			position: absolute;
			top: 0;
			left: 0;
		}
	}
	tr {
		height: 2.5rem;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	td {
		padding: 0.25rem 0;
	}
	.more-button {
		padding-top: 0.5rem;
	}
	.unread {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--secondary-fg-mid);
	}
	.trigger.unread {
		position: absolute;
		top: 0.125rem;
		right: 0.125rem;
	}
</style>
