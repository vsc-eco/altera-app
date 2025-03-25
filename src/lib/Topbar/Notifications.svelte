<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Popover from '$lib/zag/Popover.svelte';
	import { Bell, MoreHorizontal, X } from '@lucide/svelte';
	import moment from 'moment';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	const notifications = [
		{ title: 'Completed sending 20 HBD to Alice!', at: new Date(Date.now() - 1000 * 60) }
	];
</script>

{#snippet trigger(attributes: HTMLButtonAttributes)}
	<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon"><Bell /></PillButton>
{/snippet}

<Popover {trigger} title="Notifications">
	{#if notifications.length == 0}
		No notifications
	{:else}
		{#each notifications as notification}
			<div class="notif">
				<span>
					{notification.title}
					<span class="at">
						{moment(notification.at).fromNow()}
					</span>
				</span>
			</div>
		{/each}
	{/if}
</Popover>

<style lang="scss">
	.notif {
		position: relative;
		padding-top: 1rem;
		.at {
			position: absolute;
			top: 0;
			right: 0;
			font-size: var(--text-sm);
			color: var(--neutral-fg-mid);
		}
	}
</style>
