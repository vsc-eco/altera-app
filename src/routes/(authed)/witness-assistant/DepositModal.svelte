<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/AmountInput.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import { sleep } from 'aninest';
	import {
		createClient,
		getDepositTransaction,
		signAndBrodcastTransactionToHive
	} from '$lib/vscTransactions/oldVscClient/client';
	import { aiohaSigner } from '$lib/vscTransactions/oldVscClient/hive/aioha';
	import { KeyTypes } from '@aioha/aioha';
	import { Asset, type CustomJsonOperation, type TransferOperation } from '@hiveio/dhive';
	import Card from '$lib/cards/Card.svelte';
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
	const sendTransaction = async (amount: string, nodeRunnerAccount: string) => {
		if (!username || !auth.value?.aioha) return 'Error: not authenticated.';
		status = 'Awaiting transaction approval…';
		if (Number(amount) == 0) return 'Error: cannot stake 0 HIVE.';
		let stakeOp = [
			'custom_json',
			{
				required_auths: [username],
				required_posting_auths: [],
				id: 'vsc.consensus_stake',
				json: JSON.stringify({
					from: `hive:${username}`,
					to: `hive:${nodeRunnerAccount}`,
					asset: 'hive',
					net_id: 'vsc-mainnet',
					amount: Asset.from(Number(amount), 'HIVE').toString().split(' ')[0]
				})
			}
		] satisfies CustomJsonOperation;
		let depositOp = [
			'transfer',
			{
				from: username,
				to: 'vsc.gateway',
				amount: Asset.from(Number(amount), 'HIVE').toString(),
				memo: `to=${nodeRunnerAccount}`
			}
		] satisfies TransferOperation;
		let tx = [];
		if (shouldDeposit) tx.push(depositOp);
		tx.push(stakeOp);
		let res = await auth.value.aioha.signAndBroadcastTx(tx, KeyTypes.Active);
		status = '';
		if (res.success) {
			return;
		} else {
			return res.error;
		}
	};
</script>

<Card>
	{#if auth.value == undefined || auth.value!.username != undefined}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				sendTransaction(amount!, nodeRunnerAccount!).then(async (err) => {
					error = err ?? '';
					if (error != '') {
						status = '';
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
					id="stake-amount"
					label="Deposit and Stake Amount:"
					coin={Coin.hive}
					network={Network.hiveMainnet}
					bind:originalAmount={amount}
					required
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
	{:else}
		<p class="error">
			Consensus staking with an EVM wallet is currently unsupported. Please <a href="/logout"
				>logout</a
			> and login with a hive account instead.
		</p>
	{/if}
</Card>

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
