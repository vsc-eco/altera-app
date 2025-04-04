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

	/* 
	type TxVSCTransfer struct {
		Self  TxSelf
		NetId string `json:"net_id"`

		From   string `json:"from"`
		To     string `json:"to"`
		Amount string `json:"amount"`
		Asset  string `json:"asset"`
		Memo   string `json:"memo"`
	}
	type TxConsensusStake struct {
		Self TxSelf

		From   string `json:"from"`
		To     string `json:"to"`
		Amount string `json:"amount"`
		Asset  string `json:"asset"`
		NetId  string `json:"net_id"`
	}

	type TxConsensusUnstake struct {
		Self TxSelf

		From   string `json:"from"`
		To     string `json:"to"`
		Amount string `json:"amount"`
		Asset  string `json:"asset"`
		NetId  string `json:"net_id"`
	}
	*/
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
		if (!username || !auth.value?.aioha) return 'Error: not authenticated.';
		status = 'Awaiting transaction approval…';
		let res = await auth.value.aioha.signAndBroadcastTx(
			[
				[
					'transfer',
					{
						from: username,
						to: 'vsc.gateway',
						amount: Asset.from(Number(amount), 'HIVE').toString(),
						memo: `to=${nodeRunnerAccount}`
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

<document:head>
	<title>Witness Assistant</title>
</document:head>

<h1>Witness Assistant</h1>
{#if auth.value == undefined || auth.value!.username != undefined}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			sendTransaction(amount!, nodeRunnerAccount!);
		}}
	>
		<h2>Consensus Stake</h2>
		<p class="error">{error}</p>
		<Username label="Witness Account" id="node-runner" bind:value={nodeRunnerAccount} required />
		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hive]}
				id="stake-amount"
				label="Stake Amount:"
				coin={Coin.hive}
				network={Network.hiveMainnet}
				bind:originalAmount={amount}
				required
			/>
		</div>
		<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
			>Stake {amount} Hive</PillButton
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
	form {
		border: 1px solid var(--neutral-bg-accent);
		padding: 1rem;
		border-radius: 0.5rem;
		max-width: 24rem;
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
