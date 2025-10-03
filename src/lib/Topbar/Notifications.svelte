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
		removeNotification,
		setLocalNotifications
	} from './notifications';
	import { getAuth } from '$lib/auth/store';
	import { formatOpType, getTimestamp } from '$lib/stores/txStores';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	const auth = $derived(getAuth()());
	onMount(() => {
		notifications.set(getLocalNotifications());
	});
	let sortedNotifications: typeof $notifications = $state([]);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			sortedNotifications = $state.snapshot($notifications).sort((a, b) => {
				const timeA = new Date(getTimestamp(a)).getTime();
				const timeB = new Date(getTimestamp(b)).getTime();
				return timeB - timeA;
			});
		});
	});
	let length = $state(3);
	function showMore() {
		length += 10;
	}
	$effect(() => {
		if (!open) return;
		length;
		console.log('running');
		untrack(() => {
			notifications.update((current) => {
				const read = current.slice(0, length).map((notif) => ({ ...notif, read: true }));
				return [...read, ...current.slice(length)];
			});
			setLocalNotifications($notifications);
		});
	});

	let open: boolean = $state(false);
</script>

{#snippet notificationSnippet(tx: (typeof $notifications)[number])}
	{#if tx.ops && tx.ops[0]?.data}
		{@const fromYou = tx.ops[0].data.from === auth.value?.did}
		<div class="notif">
			{formatOpType(tx.ops[0])}
			{fromYou ? 'to' : 'from'}
			{`@${getAccountNameFromDid(fromYou ? tx.ops[0].data.to : tx.ops[0].data.from)}`}
			completed.
			<span class="at">
				{moment(getTimestamp(tx)).format('MMM DD H:mm')}
			</span>
			{#if !tx.read}
				<span class="unread"></span>
			{/if}
			<span class="delete">
				<PillButton onclick={() => removeNotification(tx.id)} styleType="icon-subtle">
					<Trash2 />
				</PillButton>
			</span>
		</div>
	{/if}
{/snippet}

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton
		{...attributes}
		onclick={(e) => {
			length = 3;
			attributes.onclick!(e);
		}}
		styleType="icon"
	>
		<Bell />
		{#if $notifications.some((tx) => !tx.read)}
			<span class="unread trigger"></span>
		{/if}
	</PillButton>
{/snippet}

<Popover {trigger} title="Notifications" bind:open>
	{#if $notifications.length == 0}
		No notifications currently.
	{:else}
		<table>
			<tbody>
				{#each sortedNotifications.slice(0, length) as notification}
					<tr>
						<td>{@render notificationSnippet(notification)}</td>
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
