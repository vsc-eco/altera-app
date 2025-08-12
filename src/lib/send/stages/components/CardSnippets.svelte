<script module lang="ts">
	import { Coin, type CoinOptions, Network, SendAccount } from '$lib/send/sendOptions';
	import AccountInfo from './AccountInfo.svelte';
	import AssetInfo from './AssetInfo.svelte';
	import {
		dateToLastPaidString,
		getLastPaidNetwork,
		SendTxDetails,
		type CoinOptionParam,
		type NetworkOptionParam
	} from '$lib/send/sendUtils';
	import { get } from 'svelte/store';
	import NetworkInfo from './NetworkInfo.svelte';
	import { getAuth } from '$lib/auth/store';
	import { type Contact } from '$lib/send/contacts/contacts';
	import ContactInfo from './ContactInfo.svelte';

	export interface AssetObject extends Coin {
		snippetData: { fromOpt: CoinOptionParam | undefined; net?: Network };
		snippet: typeof assetCardSnippet;
		disabled?: boolean;
		disabledMemo?: string;
	}
	export {
		assetCardSnippet as assetCard,
		accountCardSnippet as accountCard,
		networkCardSnippet as networkCard,
		contactCardSnippet as contactCard
	};
</script>

{#snippet assetCardSnippet(params: {
	fromOpt: CoinOptionParam | undefined;
	net?: Network;
	size?: 'small' | 'medium' | 'large';
})}
	<!-- <div class="card-wrapper"> -->
	{@const fromOpt = params.fromOpt}
	{#if fromOpt}
		<AssetInfo
			coinOpt={fromOpt}
			network={params.net}
			disabledMemo={fromOpt.disabledMemo}
			size={params.size}
		/>
	{/if}
	<!-- </div> -->
{/snippet}

{#snippet accountCardSnippet(account: SendAccount | undefined)}
	<!-- <div class="card-wrapper"> -->
	{#if account}
		{@const store = get(SendTxDetails)}
		<AccountInfo {account} currentCoin={store.fromCoin?.coin} />
	{/if}
	<!-- </div> -->
{/snippet}

{#snippet networkCardSnippet(net: NetworkOptionParam)}
	{@const auth = getAuth()()}

	{#await getLastPaidNetwork(auth, net.value)}
		<NetworkInfo network={net} disabledMemo={net.disabledMemo} />
	{:then lastPaidMoment}
		{@const lastPaid = dateToLastPaidString(lastPaidMoment)}
		<NetworkInfo network={net} {lastPaid} disabledMemo={net.disabledMemo} />
	{/await}
{/snippet}

{#snippet contactCardSnippet(params: { contact: Contact; size?: 'small' | 'medium' | 'large' })}
	<ContactInfo
		did={params.contact.addresses[0].address}
		name={params.contact.label}
		accounts={params.contact.addresses}
		lastPaid={params.contact.lastPaid ?? 'Never'}
		size={params.size}
	/>
{/snippet}
