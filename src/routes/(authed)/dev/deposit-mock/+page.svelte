<!--
	Dev-only route for the deposit flow redesign mock.

	URL: /dev/deposit-mock

	This is throwaway: when the MVP lands in production code (the real
	DepositOptions.svelte gets replaced), this route + the underlying
	DepositFlowMock.svelte component should be deleted.

	Lives under (authed) so anyone with a session can preview it without
	special setup; not linked from the nav.
-->
<script lang="ts">
	import DepositFlowMock from '$lib/sendswap/Deposit/DepositFlowMock.svelte';
</script>

<svelte:head>
	<title>Deposit Flow — Mock (dev)</title>
</svelte:head>

<DepositFlowMock />
