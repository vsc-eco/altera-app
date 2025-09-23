<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { sleep } from 'aninest';
	import { consensusTx } from '$lib/vscTransactions/hive';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { type OperationError, type OperationResult } from '@aioha/aioha/build/types';
	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let nodeRunnerAccount: string | undefined = $state();
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	let shouldDeposit = $state(true);
	$effect(() => {
		nodeRunnerAccount = username;
	});
	const sendTransaction = async (
		amount: string,
		nodeRunnerAccount: string
	): Promise<OperationResult> => {
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
		const res = await consensusTx(
			amount,
			nodeRunnerAccount,
			username,
			shouldDeposit,
			auth.value.aioha
		);
		if (res.success) {
			const ops: PendingTx['ops'] = [
				{
					data: {
						amount: new CoinAmount(amount, Coin.hive).toAmountString(),
						asset: Coin.hive.unit.toLowerCase(),
						from: username,
						to: nodeRunnerAccount,
						type: 'consensus_stake'
					},
					type: 'consensus_stake',
					index: 0
				}
			];
			if (shouldDeposit) {
				ops.push({
					data: {
						amount: new CoinAmount(amount, Coin.hive).toAmountString(),
						asset: Coin.hive.unit.toLowerCase(),
						from: username,
						to: nodeRunnerAccount,
						type: 'deposit',
						memo: ''
					},
					type: 'deposit',
					index: 1
				});
			}
			addLocalTransaction({
				ops: ops,
				timestamp: new Date(),
				id: res.result,
				type: 'hive'
			});
		}
		return res;
	};
</script>

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
	<h2>Consensus Staking</h2>
	<p>Be sure to be signed in with the account you'd like to deposit and stake hive from.</p>
	<p class="error">{error}</p>
	<Username label="Witness Account" id="node-runner" bind:value={nodeRunnerAccount} required />
	<div class="amount-flex">
		<Amount
			selectItems={[Coin.hive]}
			id="consensus-stake-amount"
			label="Deposit and Stake Amount:"
			coin={Coin.hive}
			network={shouldDeposit ? Network.hiveMainnet : Network.vsc}
			bind:originalAmount={amount}
			required
			maxField={shouldDeposit ? undefined : 'hive'}
		/>
	</div>
	<label for="deposit-checkbox">
		<input type="checkbox" id="deposit-checkbox" bind:checked={shouldDeposit} />
		First Deposit HIVE into VSC
	</label>
	<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
		>{#if shouldDeposit}Deposit and{/if} Stake</PillButton
	>
	<span class="status">{status}</span>
</form>

<style>
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--primary-mid);
		cursor: pointer;
	}
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
</style>
