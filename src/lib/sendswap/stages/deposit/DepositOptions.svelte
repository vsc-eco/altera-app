<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import { Coin, Network, type SendDetails } from '../../utils/sendOptions';
	import { blankDetails, SendTxDetails } from '../../utils/sendUtils';
	import LightningDeposit from './LightningDeposit.svelte';

	const auth = $derived(getAuth()());

	function next() {}
</script>

<div class="deposit-internal-wrapper">
	<h2>Deposit</h2>
	<Card>
		<div class="lightning">
			<h5>Lightning Transfer</h5>
			<LightningDeposit {next} />
		</div>
	</Card>
	<Card>
		<div class="hive-mainnet">
			<h5>Hive Mainnet</h5>
		</div>
	</Card>
</div>

<style lang="scss">
</style>
