<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Popover from '$lib/zag/Popover.svelte';
	import { Bell, Trash2 } from '@lucide/svelte';
	import moment from 'moment';
	import { onMount } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { getLocalNotifications, notifications, removeNotification } from './notifications';
	import { authStore } from '$lib/auth/store';
	import {
		formatOpType,
		getTimestamp,
		type TransactionInter
	} from '../../routes/(authed)/transactions/txStores';
	import { getAccountNameFromDid, getUsernameFromDid } from '$lib/getAccountName';
	const auth = $authStore;
	onMount(() => {
		notifications.set(getLocalNotifications());
	});
	let sortedNotifications = $derived(
		$notifications.sort((a, b) => {
			const timeA = new Date(getTimestamp(a)).getTime();
			const timeB = new Date(getTimestamp(b)).getTime();
			return timeB - timeA;
		})
	);
</script>

{#snippet notificationSnippet(tx: TransactionInter)}
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
			<span class="delete">
				<PillButton onclick={() => removeNotification(tx.id)} styleType="icon-subtle">
					<Trash2 />
				</PillButton>
			</span>
		</div>
	{/if}
{/snippet}

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon"><Bell /></PillButton>
{/snippet}

<Popover {trigger} title="Notifications">
	{#if $notifications.length == 0}
		No notifications currently.
	{:else}
		<table>
			<tbody>
				{#each sortedNotifications as notification}
					<tr>
						<td>{@render notificationSnippet(notification)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
	}
	tr {
		height: 2.5rem;
		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	td {
		padding: 0.25rem 0;
	}
</style>
