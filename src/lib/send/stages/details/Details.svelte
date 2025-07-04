<script lang="ts">
	import { SendTxDetails } from '$lib/send/sendUtils';

	let memo = $state('');
</script>

<h2>Details</h2>
<div>
	<span class="sm-caption">Memo (optional)</span>
	<input
		bind:value={memo}
		maxlength="300"
		onchange={() => {
			SendTxDetails.update((current) => ({
				...current,
				memo: memo
			}));
		}}
	/>
	<span>Custom message to the recipient.</span>
</div>

<style>
	div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input {
		width: calc(100% - 0.5rem);
	}
</style>
