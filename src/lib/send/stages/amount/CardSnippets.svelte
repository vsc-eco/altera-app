<script lang=ts>
	import { type CoinOptions, SendAccount } from '$lib/send/sendOptions';
	import AccountInfo from '../AccountInfo.svelte';
	import AssetInfo from '../AssetInfo.svelte';
    import { SendTxDetails } from '$lib/send/sendUtils';
	import { get } from 'svelte/store';
</script>

{#snippet assetCardSnippet(fromCoin: CoinOptions['coins'][number] | undefined)}
	<div class="card-wrapper">
		{#if fromCoin}
			<AssetInfo coinOpt={fromCoin} />
		{/if}
	</div>
{/snippet}

{#snippet accountCardSnippet(account: SendAccount | undefined)}
	<div class="card-wrapper">
		{#if account}
            {@const store = get(SendTxDetails)}
			<AccountInfo {account} currentCoin={store.fromCoin?.coin} />
		{/if}
	</div>
{/snippet}

<script module lang="ts">
    export { assetCardSnippet as assetCard, accountCardSnippet as accountCard}
</script>