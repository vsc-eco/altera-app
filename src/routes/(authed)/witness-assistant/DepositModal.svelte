<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/Amount.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import {
		createClient,
		getDepositTransaction,
		signAndBrodcastTransactionToHive
	} from '$lib/transactions/vscClient/client';
	import { aiohaSigner } from '$lib/transactions/vscClient/hive/aioha';
	import { KeyTypes } from '@aioha/aioha';
	import { Asset, type CustomJsonOperation, type TransferOperation } from '@hiveio/dhive';
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
		let stakeOp = [
			'custom_json',
			{
				required_auths: [username],
				required_posting_auths: [],
				id: 'vsc.consensus_stake',
				json: JSON.stringify({
					from: username,
					to: `hive:${nodeRunnerAccount}`,
					asset: 'HIVE',
					net_id: 'vsc-mainnet',
					amount: Asset.from(Number(amount), 'HIVE').toString()
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
		let res = await auth.value.aioha.signAndBroadcastTx(
			[
				[
					'transfer',
					{
						from: username,
						to: 'vsc.gateway',
						amount: Asset.from(Number(amount), 'HIVE').toString(),
						memo: `to=${username}`
					}
				] satisfies TransferOperation,
				[
					'custom_json',
					{
						required_auths: [username],
						required_posting_auths: [],
						id: 'vsc.consensus_stake',
						json: JSON.stringify({
							from: username,
							to: nodeRunnerAccount,
							asset: 'HIVE',
							netId: 'vsc-mainnet'
						})
					}
				] satisfies CustomJsonOperation
			],
			KeyTypes.Active
		);
		status = '';
		if (res.success) {
			console.log(res.result);
		} else {
			error = res.error;
		}
	};
</script>

{#if auth.value == undefined || auth.value!.username != undefined}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			sendTransaction(amount!, nodeRunnerAccount!);
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
		Staking with an EVM wallet is currently unsupported. Please <a href="/logout">logout</a> and login
		with a hive account instead.
	</p>
{/if}

<style>
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--primary-mid);
		cursor: pointer;
	}
	form {
		border: 1px solid var(--neutral-bg-accent);
		padding: 1rem;
		border-radius: 0.5rem;
		max-width: 18rem;
		box-sizing: border-box;
		padding-top: 0;
	}
	.amount-flex {
		display: flex;
	}
	.status {
		color: var(--primary-fg-mid);
	}
</style>
