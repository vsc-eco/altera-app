<script lang="ts">
	import { untrack } from 'svelte';
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import Select from '$lib/zag/Select.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { sleep } from 'aninest';
	import { consensusUnstakeTx } from '$lib/magiTransactions/hive';
	import { addLocalTransaction } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	import { fetchStakesByNode, type NodeStake } from '$lib/witness/consensusStakes';

	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let did = $derived(auth.value?.did);

	let stakes = $state.raw<NodeStake[]>([]);
	let loadingStakes = $state(false);
	/** picker selection when the account has detected stakes */
	let selectedNode: string | undefined = $state();
	/** manual entry, used only when no stake could be detected */
	let manualNode: string | undefined = $state();
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');

	let hasStakes = $derived(stakes.length > 0);
	let targetNode = $derived(hasStakes ? selectedNode : manualNode);
	let selectedStake = $derived(stakes.find((s) => s.node === selectedNode)?.staked ?? 0);
	let amountNum = $derived(Number(amount) || 0);
	let overMax = $derived(hasStakes && selectedStake > 0 && amountNum > selectedStake);
	let nodeItems = $derived(
		stakes.map((s) => ({ label: `@${s.node} — ${fmtHive(s.staked)} HIVE`, value: s.node }))
	);
	let submitDisabled = $derived(!!status || !targetNode || amountNum <= 0 || overMax);

	function fmtHive(n: number): string {
		return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
	}

	async function loadStakes(d: string) {
		loadingStakes = true;
		try {
			const result = await fetchStakesByNode(d);
			stakes = result;
			// Auto-select when there's only one node to unstake from.
			if (result.length === 1) selectedNode = result[0].node;
			else if (!result.some((s) => s.node === selectedNode)) selectedNode = undefined;
		} catch {
			stakes = [];
		} finally {
			loadingStakes = false;
		}
	}

	$effect(() => {
		const d = did;
		if (!d) return;
		untrack(() => loadStakes(d));
	});

	const sendTransaction = async (amount: string, nodeRunnerAccount: string) => {
		if (!username || !auth.value?.aioha)
			return {
				success: false,
				error: 'Error: not authenticated.',
				errorCode: 1
			};
		status = 'Awaiting transaction approval…';
		if (Number(amount) == 0)
			return {
				success: false,
				error: 'Error: cannot stake 0 HIVE.',
				errorCode: 1
			};
		const res = await consensusUnstakeTx(amount, nodeRunnerAccount, username, auth.value.aioha);
		if (res.success) {
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(amount, Coin.hive).toAmountString(),
							asset: Coin.hive.unit.toLowerCase(),
							from: username,
							to: nodeRunnerAccount,
							type: 'consensus_unstake'
						},
						type: 'consensus_unstake',
						index: 0
					}
				],
				timestamp: new Date(),
				id: res.result,
				type: 'hive'
			});
		}
		return res;
	};
</script>

{#if auth.value == undefined || auth.value!.username != undefined}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			if (!targetNode) return;
			sendTransaction(amount!, targetNode).then(async (res) => {
				if (!res.success) {
					status = '';
					error = res.error;
					return;
				}
				status = 'Transaction broadcasted successfully!';
				await sleep(1);
				status = '';
				amount = '';
				if (did) loadStakes(did);
			});
		}}
	>
		<div class="modal-title">
			<h2>Consensus Unstaking</h2>
			<InfoTooltip>
				Staking deposits your HIVE into VSC and locks it while staked. Unstaking has a short
				cooldown (about a day) before the HIVE returns to your liquid balance. Only Hive accounts
				can stake. <a href="https://docs.vsc.eco" target="_blank" rel="noopener">Learn more →</a>
			</InfoTooltip>
		</div>
		<p>
			<b>Note:</b> Unstaked coins will be made available after an unbonding period of five elections (about
			a day).
		</p>
		{#if error}<p class="error">{error}</p>{/if}

		{#if loadingStakes}
			<p class="muted">Loading your stake…</p>
		{:else if hasStakes}
			<div class="field">
				<span class="field-label">Node you staked into</span>
				<Select
					items={nodeItems}
					initial={selectedNode}
					placeholder="Select a node"
					onValueChange={(d) => (selectedNode = d.value[0])}
				/>
			</div>
			{#if selectedNode}
				<p class="staked-line">
					Staked: <span class="staked-amt">{fmtHive(selectedStake)} HIVE</span>
					<button type="button" class="max-link" onclick={() => (amount = String(selectedStake))}
						>Max</button
					>
				</p>
			{/if}
		{:else}
			<p class="muted">
				We couldn't find any consensus stake for this account. If you staked into a node, enter it
				manually below.
			</p>
			<Username
				label="Witness Account"
				id="node-runner"
				placeholder="node you staked to"
				bind:value={manualNode}
				required
			/>
		{/if}

		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hive]}
				id="unstake-amount"
				label="Unstake Amount:"
				coin={Coin.hive}
				network={Network.magi}
				bind:amountOfOriginalCoin={amount}
				required
			/>
		</div>
		{#if overMax}
			<p class="error">Amount exceeds your staked balance ({fmtHive(selectedStake)} HIVE).</p>
		{/if}
		<PillButton disabled={submitDisabled} styleType="invert" theme="primary" onclick={() => {}}
			>Initialize Unstake</PillButton
		>
		<span class="status">{status}</span>
	</form>
{:else}
	<p class="error">
		Consensus staking with an EVM wallet is currently unsupported. Please <a href="/logout"
			>logout</a
		> and login with a hive account instead.
	</p>
{/if}

<style>
	form {
		box-sizing: border-box;
		padding-top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.modal-title {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.field-label {
		font-size: 0.9rem;
	}
	.amount-flex {
		display: flex;
	}
	.staked-line {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.staked-amt {
		color: var(--dash-accent-purple);
		font-weight: 600;
	}
	.max-link {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: var(--dash-accent-purple);
		font: inherit;
		text-decoration: underline;
	}
	.muted {
		opacity: 0.75;
	}
	.status {
		color: var(--dash-accent-purple);
	}
	p {
		margin: 0;
	}
	b {
		color: var(--dash-accent-red);
		font-weight: 500;
	}
</style>
