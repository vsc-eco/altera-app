<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { authStore, getAuth } from '$lib/auth/store';
	import {
		getAccountNameFromAuth,
		getAccountNameFromDid,
		getDidFromUsername,
		getUsernameFromDid
	} from '$lib/getAccountName';
	import Username from '$lib/auth/Username.svelte';
	import ToFrom from '../../../../routes/(authed)/transactions/Table/tds/ToFrom.svelte';
	import { CircleUser, MoveDown } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import {
		allTransactionsStore,
		fetchTxs,
		toTransactionInter,
		vscTxsStore
	} from '$lib/stores/txStores';
	import { GetTransactionsStore } from '$houdini';
	import moment from 'moment';
	import { Ellipsis } from '@lucide/svelte';
	import SendTitle from '$lib/send/navigation/SendTitle.svelte';

	let {
		close,
		username = $bindable()
	} : {
		close: () => void
		username: string
	} = $props();

	const auth = $authStore;
	let recipientUsername: string | undefined = $state();
	let debouncedUsername: string | undefined = $state();

	// Debounce function - waits 300ms after user stops typing
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	function debounceUsername(value: string) {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedUsername = value;
		}, 300); // Adjust delay as needed (300ms is common)
	}

	// Watch for changes to recipientUsername
	$effect(() => {
		if (recipientUsername !== undefined) {
			debounceUsername(recipientUsername);
		}
	});

	$effect(() => {
		if (!auth.value) return;
		if ($allTransactionsStore.length === 0) {
			fetchTxs(auth.value.did, 'set');
		}
	});

	// TODO: probably use a record instead, to filter by name but keep other data
	type recipientData = {
		type: string;
		toFrom: 'to' | 'from' | 'self';
		date: string;
	};

	function getRecentContacts() {
		let result = new Map<string, recipientData[]>();
		let leaveOut = ['hive:v4vapp', auth.value?.did ?? ''];
		for (const tx of $allTransactionsStore) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (!op) continue;
				if (auth.value && op.data.from === auth.value.did && op.data.to === auth.value.did) {
					let rec: recipientData[] = result.get(auth.value.did) ?? [];
					rec.push({
						type: op.type ?? tx.type,
						toFrom: 'self',
						date: tx.anchr_ts + 'Z'
					});
					result.set(auth.value.did, rec);
				}
				if (!leaveOut.includes(op.data.from)) {
					let fromRec: recipientData[] = result.get(op.data.from) ?? [];
					fromRec.push({
						type: op.type ?? tx.type,
						toFrom: 'from',
						date: tx.anchr_ts + 'Z'
					});
					result.set(op.data.from, fromRec);
				}
				if (!leaveOut.includes(op.data.to)) {
					let toRec: recipientData[] = result.get(op.data.from) ?? [];
					toRec.push({
						type: op.type ?? tx.type,
						toFrom: 'to',
						date: tx.anchr_ts + 'Z'
					});
					result.set(op.data.to, toRec);
				}
			}
		}
		return Array.from(result);
	}

	function handleTrigger(did: string) {
		recipientUsername = getUsernameFromDid(did);
		debouncedUsername = recipientUsername;
	}
	function handleKeydown(e: KeyboardEvent, did: string) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTrigger(did);
			e.preventDefault();
		}
	}
</script>

<SendTitle close={close} />
<div class="wrapper">
	<div class="selected">
		<div class="to-icon">
			{#if debouncedUsername}
				<Avatar did={getDidFromUsername(debouncedUsername)} large />
			{:else}
				<span class="user-icon-placeholder"><CircleUser /></span>
			{/if}
		</div>
		<div class="username-input">
			<Username id="send-recipient" bind:value={recipientUsername} required wide />
		</div>
	</div>
	<div class="recent">
		<h3>Recently Paid</h3>
		<table>
			<tbody>
				{#each getRecentContacts() as [did, txs]}
					<tr onclick={() => handleTrigger(did)} onkeydown={(event) => handleKeydown(event, did)}>
						<td>
							<ToFrom otherAccount={did} />
						</td>
						<td class={['tx-description', { hasellipsis: txs.length > 3 }]}>
							{#each txs.slice(0, 3) as tx}
								<span>
									{#if tx.toFrom != 'self'}
										{tx.toFrom == 'to' ? 'sent' : 'received'}
									{/if}
									{tx.type.replaceAll('_', ' ')} on
									{moment(tx.date).format('MMM DD')}
								</span>
							{/each}
							{#if txs.length > 3}
								<span class="ellipsis"><Ellipsis /></span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style lang="scss">
	.selected {
		display: flex;
		gap: 0.75rem;
		width: 100%;
		.to-icon {
			display: flex;
			align-self: center;
			width: 3.5rem;
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
		.username-input {
			width: 100%;
		}
	}
	.recent {
		margin-top: 2rem;
		width: 100%;
		table {
			width: 100%;
			border-spacing: 1rem 0.5rem;
			border-collapse: collapse;
			position: relative;
		}
		tr {
			display: flex;
			justify-content: space-between;
			align-items: center;
			border-bottom: 1px solid var(--neutral-bg-accent);
			.tx-description {
				display: flex;
				flex-direction: column;
				text-align: right;
				line-height: 1.2rem;
				&.hasellipsis {
					translate: 0 8px;
				}
			}
		}
		tr:hover,
		tr {
			cursor: pointer;
			transition: background-color 1s;
			animation: highlight-in 1s both;
		}
	}
	.wrapper {
		margin: auto;
		max-width: 42rem;
	}
</style>
