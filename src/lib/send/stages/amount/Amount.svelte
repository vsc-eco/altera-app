<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import BasicAmountInput from '$lib/currency/BasicAmountInput.svelte';
	import swapOptions, { Coin, Network, networkMap, SendAccount, type CoinOptions, type SendDetails } from '$lib/send/sendOptions';
	import { getFromOptions, getMethodNetworks } from '$lib/send/sendUtils';
	import Select from '$lib/zag/Select.svelte';
	import AccountInfo from '../AccountInfo.svelte';
	import AssetInfo from '../AssetInfo.svelte';

	let auth = $authStore;
	let {
		details = $bindable()
	}: {
		details: SendDetails;
	} = $props();

	const assetAllowedNetworks: Network[] | undefined = $state();
	const accountAllowedNetworks: Network[] | undefined = $state();

	const networkOptions = $derived(details.method ? getMethodNetworks(details.method) : []);
	const assetOptions: CoinOptions['coins'] = $derived.by(() => {
		let result: CoinOptions['coins'] = [];
		console.log('network options', networkOptions);
		for (const net of networkOptions) {
			const coins = networkMap.get(net);
			if (!coins) continue;
			for (const coin of coins) {
				const entry = result.find((item) => item.coin.value === coin.value);
				if (entry) {
					if (entry.networks.find((item) => item.value === net.value)) continue;
					entry.networks.push(net);
				} else {
					result.push({ coin: coin, networks: [net] });
				}
			}
		}
		console.log('assetOptions', result);
		return result;
	});
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
	const fromOptions = $derived(getFromOptions(details.method, auth.value?.did));
	interface AccountObject extends SendAccount {
		snippetData: SendAccount;
		snippet: (...args: any[]) => ReturnType<import('svelte').Snippet>;
	}
	const accountOptions: AccountObject[] = $derived(
		fromOptions?.accounts.map(opt => ({
			...opt,
			snippet: accountCard,
			snippetData: opt
		})) ?? []
	);
</script>

{#snippet assetCard(fromCoin: CoinOptions['coins'][number] | undefined)}
	{#if fromCoin}
		<AssetInfo coinOpt={fromCoin} />
	{/if}
{/snippet}

{#snippet accountCard(account: SendAccount | undefined)}
	{#if account}
		<AccountInfo {account}/>
	{/if}
{/snippet}

<div class="wrapper">
	<h2>Amount</h2>
	<h3>Recipient Gets</h3>
	<BasicAmountInput bind:details id={'basic-input'} />

	<h3>Asset</h3>
	<Select items={assetObjs} styleType="card" onValueChange={v => {
		details.fromCoin = swapOptions.from.coins.find(val => val.coin.value === v.value[0]);
	}}/>

	<h3>Send From</h3>
	<Select items={accountOptions} styleType="card" />
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
</style>
