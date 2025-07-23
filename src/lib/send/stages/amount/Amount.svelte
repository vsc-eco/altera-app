<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import swapOptions, {
		Coin,
		SendAccount,
		sendAccountOptions,
		type CoinOptions
	} from '$lib/send/sendOptions';
	import { solveNetworkConstraints, SendTxDetails } from '$lib/send/sendUtils';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Select from '$lib/zag/Select.svelte';
	import { untrack } from 'svelte';
	import AccountInfo from '../AccountInfo.svelte';
	import AssetInfo from '../AssetInfo.svelte';

	let auth = $authStore;
	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	const { assetOptions, accountOptions, networkOptions } = $derived(
		solveNetworkConstraints(
			$SendTxDetails.method,
			$SendTxDetails.fromCoin,
			auth.value?.did,
			$SendTxDetails.account
		)
	);

	interface AssetObject extends Coin {
		snippetData: CoinOptions['coins'][number];
		snippet: (...args: any[]) => ReturnType<import('svelte').Snippet>;
	}
	const assetObjs: AssetObject[] = $derived(
		assetOptions.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: opt
		}))
	);
	// const fromOptions = $derived(getFromOptions($SendTxDetails.method, auth.value?.did));
	interface AccountObject extends SendAccount {
		snippetData: SendAccount;
		snippet: (...args: any[]) => ReturnType<import('svelte').Snippet>;
	}
	const accountObjs: AccountObject[] = $derived(
		accountOptions.map((opt) => ({
			...opt,
			snippet: accountCard,
			snippetData: opt
		})) ?? []
	);

	$effect(() => {
		if (networkOptions.length === 1) {
			if ($SendTxDetails.fromNetwork?.value !== networkOptions[0].value) {
				untrack(() => {
					SendTxDetails.update((current) => ({
						...current,
						fromNetwork: networkOptions[0]
					}));
				});
			}
		} else if ($SendTxDetails.fromNetwork) {
			untrack(() => {
				SendTxDetails.update((current) => ({
					...current,
					fromNetwork: undefined
				}));
			});
		}
	});

	let toCoinValue = $state('');
	$effect(() => {
		if ($SendTxDetails.account?.value === SendAccount.swap.value && toCoinValue) {
			SendTxDetails.update(current => ({
				...current,
				toCoin: swapOptions.to.coins.find((coin) => coin.coin.value === toCoinValue)
			}))
		} else if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
			SendTxDetails.update(current => ({
				...current,
				toCoin: current.fromCoin
			}))
		}
	});
	let toCoinOptions = $derived(
		swapOptions.to.coins.map((opt) => {
			return {
				icon: opt.coin.icon,
				value: opt.coin.value,
				label: opt.coin.label,
				snippet: radioLabel
			};
		})
	);
	let fromAmount = $state('');
	$inspect(fromAmount);

	$effect(() => {
		if (fromAmount !== $SendTxDetails.fromAmount) {
			SendTxDetails.update(current => ({
				...current,
				fromAmount: fromAmount
			}))
		}
	});

	$effect(() => {
		if ($SendTxDetails.fromCoin && $SendTxDetails.fromNetwork && $SendTxDetails.fromAmount !== '0') {
			editStage(id, true);
		} else {
			editStage(id, false);
		}
	})
</script>

{#snippet assetCard(fromCoin: CoinOptions['coins'][number] | undefined)}
	<div class="card-wrapper">
		{#if fromCoin}
			<AssetInfo coinOpt={fromCoin} />
		{/if}
	</div>
{/snippet}

{#snippet accountCard(account: SendAccount | undefined)}
	<div class="card-wrapper">
		{#if account}
			<AccountInfo {account} currentCoin={$SendTxDetails.fromCoin?.coin} />
		{/if}
	</div>
{/snippet}

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<div class="wrapper">
	<h2>Amount</h2>
	<h3>Recipient Gets</h3>
	<BasicAmountInput
		bind:fromAmount
		fromCoin={$SendTxDetails.fromCoin}
		fromNetwork={$SendTxDetails.fromNetwork}
		id={'basic-input'}
	/>

	<h3>Asset</h3>
	<Select
		items={assetObjs}
		styleType="card"
		onValueChange={(v) => {
			$SendTxDetails.fromCoin = swapOptions.from.coins.find((val) => val.coin.value === v.value[0]);
		}}
	/>

	<h3>Send From</h3>
	<Select
		items={accountObjs}
		styleType="card"
		onValueChange={(v) => {
			$SendTxDetails.account = sendAccountOptions.find((acc) => acc.value === v.value[0]);
		}}
	/>

	{#if $SendTxDetails.account?.value === SendAccount.swap.value}
		<div class="to-coin">
			<span class="sm-caption">To Asset</span>
			<RadioGroup required id={'network'} bind:value={toCoinValue} items={toCoinOptions} />
		</div>
	{/if}

	{#if $SendTxDetails.fromNetwork}
		<div class="from-network">
			<span class="sm-caption">Sending From Network:</span>
			<div class="network-details">
				<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
				{$SendTxDetails.fromNetwork.label}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		min-height: 75vh;
		overflow-y: auto;
		overflow-x: hidden;
		:global(button) {
			color: var(--neutral-fg);
		}
	}
	// .card-wrapper {
	// 	color: var(--neutral-fg);
	// }
	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	.sm-caption {
		color: var(--neutral-mid);
		font-size: var(--text-sm);
	}
	.from-network {
		margin-top: 2rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.network-details {
			img {
				width: 2rem;
			}
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
	}
	.to-coin {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		.sm-caption {
			padding-bottom: 0.5rem;
		}
	}
</style>
