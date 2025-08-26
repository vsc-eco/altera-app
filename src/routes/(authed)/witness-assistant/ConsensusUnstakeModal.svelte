<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import { sleep } from 'aninest';
	import { consensusUnstakeTx } from '$lib/vscTransactions/hive';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let nodeRunnerAccount: string | undefined = $state();
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	$effect(() => {
		nodeRunnerAccount = username;
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
			sendTransaction(amount!, nodeRunnerAccount!).then(async (res) => {
				if (!res.success) {
					status = '';
					error = res.error;
					return;
				}
				status = 'Transaction broadcasted successfully!';
				await sleep(1);
				status = '';
				amount = '';
			});
		}}
	>
		<h2>Consensus Unstaking</h2>
		<p>Be sure to be signed in with the account you'd like to unstake hive from.</p>
		<p>
			<b>Note:</b> Unstaked coins will be made available after an unbonding period of five elections
			(about a day).
		</p>
		<p class="error">{error}</p>
		<Username label="Witness Account" id="node-runner" bind:value={nodeRunnerAccount} required />
		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hive]}
				id="unstake-amount"
				label="Unstake Amount:"
				coin={Coin.hive}
				network={Network.vsc}
				bind:originalAmount={amount}
				required
				maxField={'hive_consensus'}
			/>
		</div>
		<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
			>Intialize Unstake</PillButton
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
	}
	.amount-flex {
		display: flex;
	}
	.status {
		color: var(--primary-fg-mid);
	}
	p {
		margin-bottom: 0.5rem;
	}
	b {
		color: var(--secondary-fg-accent-shifted);
		font-weight: 500;
	}
</style>
