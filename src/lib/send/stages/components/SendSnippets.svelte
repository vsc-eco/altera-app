<script module lang="ts">
	import { Coin, Network, SendAccount } from '$lib/send/sendOptions';
	import AccountInfo from './AccountInfo.svelte';
	import AssetInfo from './AssetInfo.svelte';
	import {
		SendTxDetails,
		type CoinOptionParam,
		type NetworkOptionParam,
		type RecipientData
	} from '$lib/send/sendUtils';
	import { get } from 'svelte/store';
	import NetworkInfo from './NetworkInfo.svelte';
	import { type Contact } from '$lib/send/contacts/contacts';
	import ContactInfo from './ContactInfo.svelte';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import moment from 'moment';

	export interface AssetObject extends Coin {
		snippetData: { fromOpt: CoinOptionParam | undefined; net?: Network };
		snippet: typeof assetCardSnippet;
		disabled?: boolean;
		disabledMemo?: string;
	}
	export interface ContactObj extends Contact {
		value: string;
		snippet: typeof contactCardSnippet;
		snippetData: typeof contactCardSnippet.arguments;
		edit?: (contact: Contact) => void;
	}
	export {
		assetCardSnippet as assetCard,
		accountCardSnippet as accountCard,
		networkCardSnippet as networkCard,
		contactCardSnippet as contactCard,
		contactRecentCardSnippet as contactRecentCard,
		basicAccRowSnippet as basicAccRow
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

{#snippet networkCardSnippet(params: {
	net: NetworkOptionParam;
	size?: 'small' | 'medium' | 'large';
	hideDetails?: boolean;
})}
	{@const net = params.net}
	<NetworkInfo
		network={net}
		disabledMemo={net.disabledMemo}
		size={params.size}
		hideDetails={!!params.hideDetails}
	/>
{/snippet}

{#snippet contactCardSnippet(params: { contact: Contact; size?: 'small' | 'medium' | 'large' })}
	<ContactInfo
		did={getDidFromUsername(params.contact.addresses[0].address)}
		name={params.contact.label}
		accounts={params.contact.addresses}
		lastPaid={params.contact.lastPaid ?? 'Never'}
		size={params.size}
		icon={params.contact.image}
	/>
{/snippet}

{#snippet contactRecentCardSnippet(contact: RecipientData)}
	<ContactInfo
		did={contact.did}
		name={contact.name}
		accounts={[{ address: getUsernameFromDid(contact.did), label: 'Primary Address' }]}
		lastPaid={contact.date ? `on ${moment(contact.date).format('MMM DD, YYYY')}` : 'Never'}
		size="medium"
		detailed={contact.date !== 'donotshow'}
	/>
{/snippet}

{#snippet basicAccRowSnippet(params: { address: Contact['addresses'][number]; required?: boolean })}
	<div class="basic-acc-row">
		<span class="sm-caption">{params.address.label}</span>
		<span>{params.address.address}</span>
	</div>
{/snippet}

<style lang="scss">
	.basic-acc-row {
		display: flex;
		width: 100%;
		gap: 1.5rem;
		.sm-caption {
			min-width: max(8ch, 20%);
		}
		overflow: hidden;
		span {
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		}
	}
</style>
