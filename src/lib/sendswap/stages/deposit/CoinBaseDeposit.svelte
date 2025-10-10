<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Instructions from '$lib/sendswap/components/Instructions.svelte';
	import { type ComponentProps } from 'svelte';
	import type { FormEventHandler } from 'svelte/elements';

	const auth = $derived(getAuth()());
	let amount = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (!auth.value) throw Error('lksajfdsfjdf');

		const did = auth.value?.did;

		const response = await fetch('/api/coinbase');
		const body = await response.json();
		console.log(response.status, body);

		console.log('alksflkjdslkjf', amount, 'salkflkjdslkf');
	}
</script>

{#if auth.value?.provider === 'aioha'}
	<form onsubmit={handleSubmit}>
		<div class="sections">
			<div class="section">
				<label for="fiat-input">Amount</label>
				<div class="amount-row">
					<div class="amount-input">
						<input id="fiat-input" bind:value={amount} type="number" />
					</div>
				</div>
			</div>

			<div class="">
				<button type="submit">Buy</button>
			</div>
		</div>
	</form>
{:else}
	<Instructions />
{/if}

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.amount-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		.amount-input {
			flex-grow: 1;
			height: 65px;
		}
		.cycle-button {
			:global(button) {
				margin: 0;
				margin-top: 2px;
			}
		}
	}
	.dest-confirm {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		.select {
			flex-grow: 1;
			:global([data-scope='select'][data-part='control']) {
				height: 52px;
			}
		}
	}
</style>
