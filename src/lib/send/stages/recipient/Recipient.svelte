<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { authStore } from '$lib/auth/store';
	import {
		getAccountNameFromAuth,
		getAccountNameFromDid,
		getDidFromUsername,
		getUsernameFromDid
	} from '$lib/getAccountName';
	import Username from '$lib/auth/Username.svelte';
	import ToFrom from '../../../../routes/(authed)/transactions/Table/tds/ToFrom.svelte';
	import { CircleUser, MapPin } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import { GetTransactionsStore } from '$houdini';
	import moment from 'moment';
	import { Ellipsis } from '@lucide/svelte';
	import { allTransactionsStore, fetchTxs, vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import type { sendDetails } from '$lib/send/sendOptions';
	import { getAccounts } from '@aioha/aioha/build/rpc';
	import {
		type Account,
		type PostingMetadata,
		postingMetadataFromString
	} from '$lib/auth/hive/accountTypes';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectContact from './SelectContact.svelte';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';

	let {
		details = $bindable()
	}: {
		details: sendDetails;
	} = $props();
	const auth = $authStore;
	let error = $state('');
	let toDid: string | undefined = $state();
	$effect(() => {
		if (!auth.value) return;
		toDid = auth.value.did;
		details.toUsername = getUsernameFromDid(auth.value.did);
	});
	let toName = $state(details.toUsername === '' ? undefined : details.toUsername);
	// get the name from hive account
	$effect(() => {
		if (auth.value?.provider !== 'aioha') return;
		(async () => {
			const accountInfo: Account = (await getAccounts([details.toUsername])).result[0];
			if (!accountInfo?.posting_json_metadata) {
				return;
			}
			const postingMetadata = postingMetadataFromString(accountInfo.posting_json_metadata).profile;
			if (postingMetadata['name']) {
				toName = postingMetadata['name'];
			}
		})();
	});

	// increment through store, keep fetching more to find last paid
	async function getLastPaid() {
		if (!auth.value?.did) return 'Never';
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					if (op?.data.to === toDid) {
						return `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
					}
				}
			}
			lastChecked = Math.max($vscTxsStore.length - 1, 0);
			const success = await waitForExtend(auth.value.did);
			if (!success) {
				break;
			}
		} while ($vscTxsStore.length > lastLength);
		return 'Never';
	}
	let lastPaid = $state('Never');
	$effect(() => {
		if (auth.value) {
			(async () => {
				lastPaid = await getLastPaid();
			})();
		}
	});
	let selectOpen = $state(false);
</script>

{#snippet recipient()}
	<h2>Recipient</h2>
	<div class="to">
		<div class="name-card">
			{#if toDid}
				<Avatar did={toDid} large />
				<div class="info">
					<span class="name">{toName ?? auth.value?.username}</span>
					<span class="available-addresses">1 Address Available</span>
					<span class="last-paid">
						Last paid
						{lastPaid}
					</span>
				</div>
				<span class="more">
					<button onclick={() => (selectOpen = true)} class="small-button"> Edit </button>
				</span>
			{:else}
				<span class="user-icon-placeholder"><CircleUser /></span>
			{/if}
		</div>
		<div class="address">
			<span class="pin"><MapPin /></span>
			<div class="data">
				<span class="faded-caption">Recipient address</span>
				<BasicCopy value={details.toUsername} />
			</div>
		</div>
	</div>
{/snippet}

{#snippet selectContact()}
	<SelectContact close={() => selectOpen = false} bind:username={details.toUsername}/>
{/snippet}

{#if selectOpen}
	<div class="select-backdrop" transition:fly={{y: 600, duration: 300}}>
		{@render selectContact()}
	</div>
{:else}
	{@render recipient()}
{/if}

<style lang="scss">
	.to {
		background-color: var(--neutral-bg-accent);
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		padding: 1rem;
		overflow: auto;
		max-height: 100%;
	}
	.name-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		background-color: var(--neutral-bg);
		border-radius: 0.5rem;
		padding: 1rem;
		.info {
			display: flex;
			flex-direction: column;
			.name {
				margin-bottom: 0.5rem;
			}
			.available-addresses {
				font-size: var(--text-sm);
				line-height: 1.2;
			}
			.last-paid {
				font-size: var(--text-sm);
				line-height: 1.2;
			}
		}
		.more {
			margin-left: auto;
		}
		.user-icon-placeholder {
			width: 3.5rem;
			height: 3.5rem;
			display: flex;
			align-items: center;
			justify-content: center;
			:global(svg) {
				width: 100%;
				height: 100%;
			}
		}
	}
	.address {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 1rem 0;
		line-height: 1.2;
		.faded-caption {
			margin-bottom: 0.25rem;
		}
		.pin {
			display: flex;
			align-items: center;
			padding: 0.75rem;
			background-color: var(--neutral-bg-accent-shifted);
			border-radius: 2.5rem;
		}
		.data {
			display: flex;
			flex-direction: column;
		}
	}
	.faded-caption {
		color: var(--neutral-mid);
		font-size: var(--text-xs);
	}
	.small-button {
		border: none;
		background-color: transparent;
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--accent-fg-mid);
	}
	.select-backdrop {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(100vw - 1rem);
		height: 100vh;
		background-color: var(--neutral-bg);
		z-index: 500;
		padding: 0 0.5rem;
	}
</style>
