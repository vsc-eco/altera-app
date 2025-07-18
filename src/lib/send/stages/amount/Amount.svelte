<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import swapOptions, {
		Coin,
		SendAccount,
		sendAccountOptions,
		type CoinOptions,
		type SendDetails
	} from '$lib/send/sendOptions';
	import { solveNetworkConstraints } from '$lib/send/sendUtils';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import Select from '$lib/zag/Select.svelte';
	import AccountInfo from '../AccountInfo.svelte';
	import AssetInfo from '../AssetInfo.svelte';

	let auth = $authStore;
	let {
		details = $bindable()
	}: {
		details: SendDetails;
	} = $props();

	const { assetOptions, accountOptions, networkOptions } = $derived(
		solveNetworkConstraints(details.method, details.fromCoin, auth.value?.did, details.account)
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
	// const fromOptions = $derived(getFromOptions(details.method, auth.value?.did));
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
			if (details.fromNetwork?.value !== networkOptions[0].value) {
				details.fromNetwork = networkOptions[0];
			}
		} else {
			details.fromNetwork = undefined;
		}
	});

	let toCoinValue = $state('');
	$effect(() => {
		if (details.account?.value === SendAccount.swap.value && toCoinValue) {
			details.toCoin = swapOptions.to.coins.find((coin) => coin.coin.value === toCoinValue);
		} else {
			details.toCoin = details.fromCoin;
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
</script>

{#snippet assetCard(fromCoin: CoinOptions['coins'][number] | undefined)}
	{#if fromCoin}
		<AssetInfo coinOpt={fromCoin} />
	{/if}
{/snippet}

{#snippet accountCard(account: SendAccount | undefined)}
	{#if account}
		<AccountInfo {account} currentCoin={details.fromCoin?.coin} />
	{/if}
{/snippet}

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<div class="wrapper">
	<h2>Amount</h2>
	<h3>Recipient Gets</h3>
	<BasicAmountInput bind:details id={'basic-input'} />

	<h3>Asset</h3>
	<Select
		items={assetObjs}
		styleType="card"
		onValueChange={(v) => {
			details.fromCoin = swapOptions.from.coins.find((val) => val.coin.value === v.value[0]);
		}}
	/>

	<h3>Send From</h3>
	<Select
		items={accountObjs}
		styleType="card"
		onValueChange={(v) => {
			details.account = sendAccountOptions.find((acc) => acc.value === v.value[0]);
		}}
	/>

	{#if details.account?.value === SendAccount.swap.value}
		<div class="to-coin">
			<RadioGroup required id={'network'} bind:value={toCoinValue} items={toCoinOptions} />
		</div>
	{/if}

	{#if details.fromNetwork}
		<div class="from-network">
			<span class="sm-caption">Sending From Network:</span>
			<div class="network-details">
				<img src={details.fromNetwork.icon} alt={details.fromNetwork.label} />
				{details.fromNetwork.label}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.wrapper {
		min-height: 75vh;
		overflow-y: auto;
	}
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
	}
</style>
