<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { getAuth } from '$lib/auth/store';
	import { GetTransactionsStore } from '$houdini';
	// GetTransactions
	import moment from 'moment';
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import { browser } from '$app/environment';
	import mainnetSampleData from './mainnetSampleData';
	import { Asset, type AssetSymbol } from '@hiveio/dhive';
	import getSampleData from './getSampleData';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';

	let {
		did
	}: {
		did: string;
	} = $props();
	// let store = $derived(new GetTransactionsStore());
	// let data = $derived($store.data);
	let data = getSampleData(did);
	// $inspect($store.data);
	// $effect(() => {
	// 	if (!browser) return;
	// 	store.fetch({
	// 		variables: {
	// 			// limit: 5, // FIXME: add back once server properly supports pagination
	// 			did
	// 		}
	// 	});
	// });
	// let currStoreLen = $derived($store.data?.findLedgerTXs?.txs?.length);
	const auth = $derived(getAuth()());
	$inspect(auth.value?.did);
	const START_BLOCK = 88079516;
	const START_BLOCK_TIME = moment('2024-08-16T02:46:48Z');

	function getDateFromBlockHeight(blockHeight: number) {
		const date =
			(blockHeight - START_BLOCK) * 3 < 0
				? START_BLOCK_TIME.clone().subtract(-(blockHeight - START_BLOCK) * 3, 'seconds')
				: START_BLOCK_TIME.clone().add((blockHeight - START_BLOCK) * 3, 'seconds');
		return date;
	}
</script>

<svelte:window
	onscroll={() => {
		if (
			document.documentElement.scrollHeight -
				document.documentElement.scrollTop -
				document.documentElement.clientHeight <
			1
		) {
			// store.loadNextPage() // FIXME: uncomment once backend properly supports pagination
		}
	}}
/>
<div class="scroll">
	<table>
		<thead>
			<tr>
				<th>Date</th>
				<th>To/From</th>
				<th class="amount-header">Amount</th>
				<th class="token-header">Token</th>
				<th>Type</th>
			</tr>
		</thead>
		{#if data}
			<tbody>
				{#each data as { data: { from, to, amount, asset: tk, memo, type: t }, anchr_height: { $numberLong: block_height }, id, status, required_auths: [owner] }}
					<!-- {#each data.findLedgerTXs!.txs! as { amount, block_height, from, id, idx, status, owner, t, tk }} -->
					{@const [otherAccount, fromOrTo] =
						to == from
							? [from!, t.includes('unstake') ? 'to' : 'from']
							: to == did
								? [from!, 'from']
								: [to!, 'to']}
					<tr>
						<td class="date">
							{getDateFromBlockHeight(Number.parseInt(block_height)).format('MMM D')}
						</td>
						<td>
							<span class="to-from">
								<Avatar did={otherAccount} fallback=""></Avatar>
								{getAccountNameFromDid(otherAccount)}
							</span>
						</td>
						<td>
							<span
								class={[
									'amount',
									{
										transfer: t == 'transfer',
										primary: fromOrTo == 'from',
										secondary: fromOrTo == 'to'
									}
								]}
							>
								{#if Number.parseFloat(amount)}
									{#if fromOrTo == 'from'}
										+
									{:else if fromOrTo == 'to'}
										-
									{/if}{new Intl.NumberFormat().format(Number.parseFloat(amount))}
								{:else}
									invalid
								{/if}
							</span>
						</td>
						<td>
							<span
								class={[
									'token',
									{
										primary: fromOrTo == 'from',
										secondary: fromOrTo == 'to'
									}
								]}
							>
								{#if Number.parseFloat(amount)}
									{tk.toUpperCase()}
								{/if}
							</span></td
						>
						<td>
							<span class="type">
								{#if fromOrTo == 'from'}
									<ArrowRight />
								{:else}
									<ArrowLeft></ArrowLeft>
								{/if}

								{t}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		{:else}
			<tbody>
				<tr><td colspan="10" class="loading">Loading..</td></tr>
			</tbody>
		{/if}
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
		overflow-y: auto;
		height: calc(100% - 7.5rem);
		position: absolute;
		width: calc(100% - 0.5rem);
		display: block;
	}
	table {
		width: 100%;
	}
	.loading {
		background-color: var(--neutral-bg-accent);
	}
	thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: var(--neutral-bg);
	}
	th {
		text-align: left;
		padding: 0.5rem min(1rem, 2%);
	}
	td {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);
		width: max-content;

		border-bottom: 1px solid var(--neutral-bg-accent);
	}
	.amount,
	.token {
		color: var(--fg-mid);
	}
	.amount,
	.token {
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	td:has(.amount) {
		padding-right: 0.5rem;
		text-align: right;
	}

	td:has(.token) {
		padding-left: 0;
	}
	.token-header {
		padding-left: 0;
	}
	.amount-header {
		text-align: right;
		padding-right: 0.5rem;
	}

	.date {
		width: 4rem;
	}

	.to-from,
	.type,
	.amount {
		display: inline-flex;

		justify-content: left;
		gap: 0.25rem;
		align-items: center;
	}
</style>
