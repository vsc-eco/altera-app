<script lang="ts">
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import { getAccountNameFromAddress } from '$lib/getAccountName';
	import { SendTxDetails } from '../utils/sendUtils';
	import { Network } from '../utils/sendOptions';
	import Card from '$lib/cards/Card.svelte';
	import { Info } from '@lucide/svelte';

	let toAccount = $derived(
		$SendTxDetails.toNetwork?.value === Network.magi.value
			? 'vsc.gateway'
			: $SendTxDetails.toUsername
	);
</script>

<Card>
	<div class="blurb">
		<span><Info /></span>
		<p>
			Transfer {$SendTxDetails.toCoin?.coin.label} to the following Hive account with your favorite wallet
			or exchange.
			{#if $SendTxDetails.toNetwork?.value === Network.magi.value}
				The account vsc.gateway is a dedicated Hive account controlled by the decentralized VSC
				consensus. Your funds remain within your wallet on VSC at all times. Please make sure to
				specify the correct memo when sending Hive or HBD.
			{:else}
				Learn more about obtaining a Hive account <a href="https://hive.io/">here</a>.
			{/if}
		</p>
	</div>
</Card>

<table>
	<tbody>
		<tr>
			<td class="sm-caption label">Transfer To</td>
			<td class="content"><BasicCopy value={'vsc.gateway'}><code>{toAccount}</code></BasicCopy></td>
		</tr>
		{#if Number($SendTxDetails.toAmount) > 0}
			<tr>
				<td class="sm-caption label">Amount</td>
				<td class="content"
					><BasicCopy value={$SendTxDetails.toAmount}>
						<code>{$SendTxDetails.toAmount}</code> {$SendTxDetails.fromCoin?.coin.label}</BasicCopy
					></td
				>
			</tr>
		{/if}
		<tr>
			<td class="sm-caption label">Memo</td>
			<td class="content"
				><BasicCopy value={`to=${$SendTxDetails.toUsername}`}
					><code>to={getAccountNameFromAddress($SendTxDetails.toUsername)}</code></BasicCopy
				></td
			>
		</tr>
	</tbody>
</table>

<style lang="scss">
	table {
		margin-top: 1rem;
	}
	table,
	tbody,
	tr {
		width: calc(100% - 1rem);
	}
	tr {
		display: flex;
	}
	td {
		height: 2.5rem;
		display: flex;
		align-items: center;
	}
	.label {
		flex: 0 1 12rem;
	}
	.blurb {
		display: flex;
		align-items: center;
		gap: 1rem;
		p {
			line-height: 1.2;
		}
	}
</style>
