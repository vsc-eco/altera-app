<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Username from '$lib/auth/Username.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import { Coin, Network } from '$lib/send/sendOptions';
	import { sleep } from 'aninest';
	import { hbdStakeTx, hbdUnstakeTx } from '..';
	import type { OperationResult, OperationError, OperationSuccess } from '@aioha/aioha/build/types';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';
	import { getDidFromUsername } from '$lib/getAccountName';
	import {
		createClient,
		signAndBrodcastTransaction,
		type StakeTransaction
	} from '$lib/vscTransactions/eth/client';
	import { wagmiSigner } from '$lib/vscTransactions/eth/wagmi';
	import { wagmiConfig } from '$lib/auth/reown';
	let { type }: { type: 'stake' | 'unstake' } = $props();
	let auth = $derived(getAuth()());
	let username = $derived(
		auth.value?.provider == 'aioha' ? auth.value?.username : auth.value?.address
	);
	let recipient: string | undefined = $state();
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	const allowDeposit = $derived(type === 'stake' && auth.value?.provider === 'aioha');
	let shouldDeposit = $state(false);
	$effect(() => {
		shouldDeposit = allowDeposit;
	});
	$effect(() => {
		recipient = username;
	});
	const sendTransaction = async (amount: string, recipient: string): Promise<OperationResult> => {
		if (!auth.value)
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
		if (auth.value.provider == 'reown') {
			const client = createClient(auth.value.did);
			const coinAmt = new CoinAmount(amount, Coin.hbd);
			const stakeOp: StakeTransaction = {
				op: type === 'stake' ? 'stake_hbd' : 'unstake_hbd',
				payload: {
					from: auth.value.did,
					to: getDidFromUsername(recipient),
					amount: coinAmt.toPrettyAmountString(),
					asset: coinAmt.coin.unit.toLowerCase(),
					type: type === 'stake' ? 'stake_hbd' : 'unstake_hbd'
				}
			};
			let returnVal: OperationResult = {
				success: false,
				errorCode: 0,
				error: 'Transaction failed.'
			};
			try {
				const result = await signAndBrodcastTransaction(
					[stakeOp],
					wagmiSigner, // version with error handling
					client,
					undefined,
					wagmiConfig
				);
				status = `Transaction submitted successfully! ID: ${result.id}`;

				// TODO: add back when backend fixed
				// add local storage tx
				// addLocalTransaction({
				// 	ops: [
				// 		{
				// 			data: {
				// 				...stakeOp.payload,
				// 				type: stakeOp.op
				// 			},
				// 			type: stakeOp.op,
				// 			index: 0
				// 		}
				// 	],
				// 	timestamp: new Date(),
				// 	id: result.id,
				// 	type: 'vsc'
				// });

				returnVal = {
					success: true,
					result: result.id.toString()
				};
			} catch (error) {
				console.error('Transaction error:', error);
				if (error instanceof Error) {
					let cleanError = 'Transaction failed.';
					if (error.message.includes('User rejected') || error.message.includes('rejected')) {
						cleanError = 'Transaction was cancelled by user';
					} else if (error.message.includes('wallet')) {
						cleanError = 'Please connect your wallet and try again';
					} else if (error.message.includes('422')) {
						cleanError = 'Transaction format error. Please check your inputs and try again';
					} else if (error.message.includes('network') || error.message.includes('Network')) {
						cleanError = 'Network error. Please check your connection and try again';
					}
					returnVal = {
						success: false,
						errorCode: 0,
						error: cleanError
					};
					status = cleanError;
				} else {
					status = 'Unknown error occurred during transaction';
				}
			}
			return returnVal;
		} else {
			if (!username || !auth.value.aioha)
				return {
					success: false,
					error: 'Error: not authenticated.',
					errorCode: 1
				};
			const res =
				type === 'stake'
					? await hbdStakeTx(amount, recipient, username, shouldDeposit, auth.value.aioha)
					: await hbdUnstakeTx(amount, recipient, username, shouldDeposit, auth.value.aioha);

			if (res.success) {
				const ops: PendingTx['ops'] = [
					{
						data: {
							amount: new CoinAmount(amount, Coin.hbd).toAmountString(),
							asset: Coin.hbd.unit.toLowerCase(),
							from: username,
							to: recipient,
							type: type === 'stake' ? 'stake_hbd' : 'unstake_hbd'
						},
						type: type === 'stake' ? 'stake_hbd' : 'unstake_hbd',
						index: 0
					}
				];
				if (shouldDeposit) {
					ops.push({
						data: {
							amount: new CoinAmount(amount, Coin.hbd).toAmountString(),
							asset: Coin.hbd.unit.toLowerCase(),
							from: username,
							to: recipient,
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
		}
	};
</script>

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
	{#if type === 'stake'}
		<h2>Stake HBD</h2>
	{:else}
		<h2>Unstake HBD</h2>
	{/if}
	<p>Be sure to be signed in with the account you'd like to deposit and stake HBD from.</p>
	{#if type === 'unstake'}
		<p>
			<b>Note:</b> Unstaked coins will be made available after about three days.
		</p>
	{/if}
	<p class="error">{error}</p>
	<Username label="Recipient" id="hbd-stake-recipient" bind:value={recipient} required />
	<div class="amount-flex">
		<Amount
			selectItems={[Coin.hbd]}
			id="hbd-stake-amount"
			label="Deposit and Stake Amount:"
			coin={Coin.hbd}
			network={shouldDeposit ? Network.hiveMainnet : Network.vsc}
			bind:originalAmount={amount}
			required
			maxField={type === 'stake' ? (shouldDeposit ? undefined : 'hbd') : 'hbd_savings'}
		/>
	</div>
	{#if allowDeposit}
		<label for="hbd-stake-checkbox">
			<input type="checkbox" id="hbd-stake-checkbox" bind:checked={shouldDeposit} />
			First Deposit HBD into VSC
		</label>
	{/if}
	<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
		>{#if shouldDeposit}Deposit and{/if}
		{#if type === 'stake'}Stake{:else}Initialize Unstake{/if}</PillButton
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
