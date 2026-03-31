<script lang="ts">
	import { getAccountNameFromAuth, getAccountNameFromDid } from '$lib/getAccountName';
	import { page } from '$app/state';
	import Table from './Table/Table.svelte';
	import { getAuth } from '$lib/auth/store';
	import { goto } from '$app/navigation';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	// let did = 'hive:techcoderx';
	const autoOpenOp: [string, number] | undefined = $derived.by(() => {
		const autoOpenTxId = page.url.searchParams.get('tx');
		const autoOpenIndex = Number(page.url.searchParams.get('index'));
		if (autoOpenTxId) {
			return [autoOpenTxId, autoOpenIndex];
		}
		return undefined;
	});

	$effect(() => {
		if (autoOpenOp) {
			goto(page.url.pathname, { replaceState: true });
		}
	});
</script>

<document:head>
	<title>Transactions</title>
</document:head>
<div class="flex">
	<h1>Transactions involving {did ? getAccountNameFromDid(did) : '0xd072...AdAA'}</h1>
	{#if did}
		<Table {did} initialOpen={autoOpenOp}></Table>
	{/if}
	{#if !did || true}
		<div class="mock-table">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>To / From</th>
						<th class="amount-h">Amount</th>
						<th>Token</th>
						<th>Type</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						{ date: 'Jan 12, 2026', addr: '0x38E...SDF0', amount: '-1.000', token: 'HIVE', type: 'TRANSFER' },
						{ date: 'Jan 11, 2026', addr: '0x38E...SDF0', amount: '-53.250', token: 'HIVE', type: 'WITHDRAW' },
						{ date: 'Jan 10, 2026', addr: '0x38E...SDF0', amount: '-1.000', token: 'HIVE', type: 'TRANSFER' },
						{ date: 'Jan 09, 2026', addr: '0x38E...SDF0', amount: '+0.400', token: 'HBD', type: 'TRANSFER', positive: true },
						{ date: 'Jan 10, 2026', addr: '0x38E...SDF0', amount: '-0.400', token: 'HBD', type: 'TRANSFER' },
						{ date: 'Jan 10, 2026', addr: '0x38E...SDF0', amount: '+1.000', token: 'HIVE', type: 'TRANSFER', positive: true },
						{ date: 'Jan 09, 2026', addr: '0x38E...SDF0', amount: '-0.400', token: 'HBD', type: 'TRANSFER' },
						{ date: 'Jan 08, 2026', addr: '0x38E...SDF0', amount: '+1.000', token: 'HIVE', type: 'TRANSFER', positive: true },
						{ date: 'Jan 07, 2026', addr: '0x38E...SDF0', amount: '-2.500', token: 'HBD', type: 'SWAP' },
						{ date: 'Jan 06, 2026', addr: '0x38E...SDF0', amount: '+150.000', token: 'HIVE', type: 'DEPOSIT', positive: true },
						{ date: 'Jan 05, 2026', addr: '0x38E...SDF0', amount: '-25.000', token: 'HIVE', type: 'STAKE' },
						{ date: 'Jan 04, 2026', addr: '0x38E...SDF0', amount: '+0.180', token: 'HBD', type: 'REWARD', positive: true }
					] as row}
						<tr>
							<td class="date">{row.date}</td>
							<td class="addr"><span class="addr-dot"></span>{row.addr}</td>
							<td class="amount" class:positive={row.positive}>{row.amount} {row.token}</td>
							<td class="token">{row.token}</td>
							<td><span class="badge" class:withdraw={row.type === 'WITHDRAW'} class:swap={row.type === 'SWAP'} class:deposit={row.type === 'DEPOSIT'} class:stake={row.type === 'STAKE'} class:reward={row.type === 'REWARD'}>{row.type}</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	h1 {
		display: flex;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
	}
	.flex {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 4.5rem);
	}
	.mock-table {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 27px;
		box-shadow: var(--dash-card-shadow);
		padding: 1.25rem;
		flex: 1;
		overflow: auto;
	}
	.mock-table table {
		width: 100%;
		border-collapse: collapse;
		font-family: 'Nunito Sans', sans-serif;
	}
	.mock-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		color: var(--dash-text-muted);
		font-weight: 600;
		font-size: 0.8rem;
		border-bottom: 1px solid var(--dash-divider);
	}
	.mock-table .amount-h {
		text-align: right;
	}
	.mock-table td {
		padding: 0.75rem 1rem;
		font-size: 0.85rem;
		color: var(--dash-text-primary);
		border-bottom: 1px solid var(--dash-divider);
	}
	.mock-table tr:last-child td {
		border-bottom: none;
	}
	.mock-table .date {
		color: var(--dash-text-secondary);
		white-space: nowrap;
	}
	.mock-table .addr {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--dash-text-secondary);
		font-family: monospace;
		font-size: 0.8rem;
	}
	.mock-table .addr-dot {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--dash-surface-alt);
		flex-shrink: 0;
	}
	.mock-table .amount {
		text-align: right;
		font-weight: 600;
	}
	.mock-table .amount.positive {
		color: var(--dash-accent-green-light);
	}
	.mock-table .token {
		color: var(--dash-text-secondary);
	}
	.mock-table .badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 2rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.1);
		color: var(--dash-text-primary);
	}
	.mock-table .badge.withdraw {
		background: var(--dash-badge-withdraw-bg);
		color: var(--dash-badge-withdraw-text);
	}
	.mock-table .badge.swap {
		background: rgba(111, 106, 248, 0.15);
		color: #6F6AF8;
	}
	.mock-table .badge.deposit {
		background: var(--dash-badge-green-bg);
		color: var(--dash-badge-green-text);
	}
	.mock-table .badge.stake {
		background: rgba(111, 106, 248, 0.15);
		color: #6F6AF8;
	}
	.mock-table .badge.reward {
		background: var(--dash-badge-green-bg);
		color: var(--dash-badge-green-text);
	}
</style>
