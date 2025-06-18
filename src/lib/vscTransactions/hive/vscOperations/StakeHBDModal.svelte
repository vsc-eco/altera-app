<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/AmountInput.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import { sleep } from 'aninest';
	import { hbdStakeTx, hbdUnstakeTx } from '..';
	import { addLocalTransaction, type PendingTx } from '$lib/send/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { type OperationResult } from '@aioha/aioha/build/types';
	let { type }: { type: "stake" | "unstake" } = $props();
	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	let recipient: string | undefined = $state();
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	let shouldDeposit = $state(type === "stake");
	$effect(() => {
		recipient = username;
	});
	const sendTransaction = async (amount: string, recipient: string): Promise<OperationResult> => {
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
				error: 'Error: cannot stake 0 HBD.',
				errorCode: 1
			};
		const res = type === "stake"
            ? await hbdStakeTx(amount, recipient, username, shouldDeposit, auth.value.aioha)
			: await hbdUnstakeTx(amount, recipient, username, shouldDeposit, auth.value.aioha);

        // TODO: implement once backend is fixed
		// if (res.success) {
		// 	const ops: PendingTx['ops'] = [
		// 		{
		// 			data: {
		// 				amount: new CoinAmount(amount, Coin.hbd).toAmountString(),
		// 				asset: Coin.hbd.unit.toLowerCase(),
		// 				from: username,
		// 				to: recipient,
		// 				type: 'unstake'
		// 			},
		// 			type: 'unstake',
		// 			index: 0
		// 		}
		// 	];
		// 	if (shouldDeposit) {
		// 		ops.push({
		// 			data: {
		// 				amount: new CoinAmount(amount, Coin.hbd).toAmountString(),
		// 				asset: Coin.hbd.unit.toLowerCase(),
		// 				from: username,
		// 				to: recipient,
		// 				type: 'deposit',
		// 				memo: ''
		// 			},
		// 			type: 'deposit',
		// 			index: 1
		// 		});
		// 	}
		// 	addLocalTransaction({
		// 		ops: ops,
		// 		timestamp: new Date(),
		// 		id: res.result,
		// 		type: 'hive'
		// 	});
		// }
		return res;
	};
</script>

{#if auth.value == undefined || auth.value!.username != undefined}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			sendTransaction(amount!, recipient!).then(async (res) => {
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
        {#if type==="stake"}
            <h2>Stake HBD</h2>
        {:else}
            <h2>Unstake HBD</h2>
        {/if}
		<p>Be sure to be signed in with the account you'd like to deposit and stake HBD from.</p>
        {#if type==="unstake"}
        <p>
			<b>Note:</b> Unstaked coins will be made available after about three days.
		</p>
        {/if}
		<p class="error">{error}</p>
		<Username label="Recipient" id="node-runner" bind:value={recipient} required />
		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hbd]}
				id="stake-amount"
				label="Deposit and Stake Amount:"
				coin={Coin.hbd}
				network={shouldDeposit ? Network.hiveMainnet : Network.vsc}
				bind:originalAmount={amount}
				required
			/>
        </div>
        {#if type==="stake"}
            <label for="hbd-stake-checkbox">
                <input type="checkbox" id="hbd-stake-checkbox" bind:checked={shouldDeposit} />
                First Deposit HBD into VSC
            </label>
        {/if}
        <PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
            >{#if shouldDeposit}Deposit and{/if} {#if type==="stake"}Stake{:else}Unstake{/if}</PillButton
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
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--primary-mid);
		cursor: pointer;
	}
	form {
		box-sizing: border-box;
		padding-top: 0;
        min-height: 333px;
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
