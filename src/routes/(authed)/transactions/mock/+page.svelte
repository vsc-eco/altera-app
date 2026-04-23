<script lang="ts">
	import { onMount } from 'svelte';
	import Table from '../Table/Table.svelte';
	import { magiTxsStore, btcDepositStore } from '$lib/stores/txStores';
	import type { TransactionInter } from '$lib/stores/txStores';
	import type { BtcDepositEvent } from '$lib/indexer/btcMappingQueries';
	import {
		sampleTransfer,
		sampleDeposit,
		sampleWithdraw,
		sampleStakeHbd,
		sampleUnstakeHbd,
		sampleConsensusStake,
		sampleConsensusUnstake,
		sampleSwapNewHiveToBtc,
		sampleSwapNewHbdToHive,
		sampleSwapNewBtcToHbd,
		sampleSwapOld,
		sampleAddLiquidity,
		sampleRemoveLiquidity,
		sampleBtcTransferToHive,
		sampleBtcTransferToEvm,
		sampleBtcUnmap,
		sampleBtcDepositEvent,
		sampleFailed
	} from '../mockUp';

	// Lift raw mock objects into the full TransactionInter shape that the table expects.
	// Required extra fields: isPending, anchr_height, first_seen, output.
	// anchr_ts may already be present; if not we supply a fallback.
	function toTx(raw: Record<string, unknown>, fallbackTs = '2026-01-01T00:00:00'): TransactionInter {
		return {
			isPending: false,
			anchr_height: 0,
			first_seen: ((raw.anchr_ts as string | undefined) ?? fallbackTs) + 'Z',
			output: null,
			ledger: null,
			...raw
		} as unknown as TransactionInter;
	}

	// All VSC mock transactions in the order they should appear in the table.
	const mockVscTxs: TransactionInter[] = [
		toTx(sampleTransfer),
		toTx(sampleDeposit),
		toTx(sampleWithdraw),
		toTx(sampleStakeHbd),
		toTx(sampleUnstakeHbd, '2026-01-05T10:00:00'),
		toTx(sampleConsensusStake, '2026-01-04T10:00:00'),
		toTx(sampleConsensusUnstake, '2026-01-03T10:00:00'),
		toTx(sampleSwapNewHiveToBtc),
		toTx(sampleSwapNewHbdToHive),
		toTx(sampleSwapNewBtcToHbd),
		toTx(sampleSwapOld),
		toTx(sampleAddLiquidity, '2026-01-02T10:00:00'),
		toTx(sampleRemoveLiquidity, '2026-01-01T10:00:00'),
		toTx(sampleBtcTransferToHive),
		toTx(sampleBtcTransferToEvm),
		toTx(sampleBtcUnmap),
		toTx(sampleFailed)
	];

	const mockBtcDeposit: BtcDepositEvent = {
		indexer_tx_hash: sampleBtcDepositEvent.indexer_tx_hash,
		indexer_ts: sampleBtcDepositEvent.indexer_ts,
		indexer_block_height: sampleBtcDepositEvent.indexer_block_height,
		indexer_contract_id: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d',
		amount: sampleBtcDepositEvent.amount,
		recipient: sampleBtcDepositEvent.recipient,
		sender: 'bc1qexamplesenderaddress000000000000000000'
	};

	// Total mock items = VSC txs + 1 BTC deposit event.
	// Passed as `limit` to Table so it shows all items AND skips the initial fetch
	// (Table only calls fetchTxs when allTransactionsStore.length < limit).
	const MOCK_ITEM_COUNT = mockVscTxs.length + 1;

	// Populate stores synchronously (before Table's onMount runs) so that:
	//   allTransactionsStore.length >= MOCK_ITEM_COUNT → Table skips the 'set' fetch.
	// The 'update' interval uses FETCH_DID which is a non-existent account, so the
	// API returns empty/null and the 'update' path bails without touching the store.
	const FETCH_DID = 'hive:__mock_preview__';
	magiTxsStore.set(mockVscTxs);
	btcDepositStore.set([mockBtcDeposit]);

	onMount(() => {
		// Clear mock data when navigating away so normal pages see empty stores
		// (they refetch from their own onMount).
		return () => {
			magiTxsStore.set([]);
			btcDepositStore.set([]);
		};
	});
</script>

<document:head>
	<title>Mock Transactions Preview</title>
</document:head>

<div class="page">
	<div class="banner">
		⚠️ Dev preview — mock data only, no real account loaded
	</div>
	<div class="legend">
		<h2>Transaction Type Coverage</h2>
		<div class="grid">
			<span class="tag verified">✅ Transfer</span>
			<span class="tag verified">✅ Deposit</span>
			<span class="tag verified">✅ Withdraw</span>
			<span class="tag verified">✅ Stake HBD (FAILED)</span>
			<span class="tag constructed">🔧 Unstake HBD</span>
			<span class="tag constructed">🔧 Consensus Stake</span>
			<span class="tag constructed">🔧 Consensus Unstake</span>
			<span class="tag verified">✅ Swap HIVE→BTC (new router)</span>
			<span class="tag verified">✅ Swap HBD→HIVE (new router)</span>
			<span class="tag verified">✅ Swap BTC→HBD (old pool)</span>
			<span class="tag verified">✅ Swap old pool format</span>
			<span class="tag constructed">🔧 Add Liquidity</span>
			<span class="tag constructed">🔧 Remove Liquidity</span>
			<span class="tag verified">✅ BTC Transfer → Hive acct</span>
			<span class="tag verified">✅ BTC Transfer → EVM addr</span>
			<span class="tag verified">✅ BTC Unmap (withdraw)</span>
			<span class="tag verified">✅ BTC Deposit (indexer event)</span>
			<span class="tag verified">✅ Failed transaction</span>
		</div>
		<p class="note">
			✅ verified from real on-chain data &nbsp;|&nbsp; 🔧 constructed from source code
		</p>
	</div>

	<div class="table-wrapper">
		<!--
			did={FETCH_DID}  → a non-existent account so the 2-second update interval
			                    fetches nothing and never overwrites mock data.
			limit={MOCK_ITEM_COUNT} → prevents the initial 'set' fetch (Table only fetches
			                          when store.length < limit, and we pre-populate above).
		-->
		<Table did={FETCH_DID} limit={MOCK_ITEM_COUNT} allowPopup={true} />
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		min-height: 100vh;
	}
	.banner {
		background: rgba(255, 165, 0, 0.15);
		border: 1px solid rgba(255, 165, 0, 0.4);
		border-radius: 10px;
		padding: 0.75rem 1.25rem;
		font-size: 0.9rem;
		color: var(--dash-text-secondary);
		font-weight: 500;
	}
	.legend {
		background: var(--dash-card-bg);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 1.25rem;
	}
	h2 {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.tag {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 2rem;
		font-size: 0.75rem;
		font-weight: 500;
	}
	.tag.verified {
		background: rgba(0, 200, 100, 0.12);
		color: var(--dash-accent-green-light, #4caf7d);
	}
	.tag.constructed {
		background: rgba(111, 106, 248, 0.12);
		color: #6f6af8;
	}
	.note {
		margin: 0.75rem 0 0;
		font-size: 0.75rem;
		color: var(--dash-text-muted);
	}
	.table-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
