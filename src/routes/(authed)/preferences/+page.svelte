<script>
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import PillButton from '$lib/PillButton.svelte';
	import { GQL_URL } from '../../../client';
	let vscGqlUrlInput = $state();
</script>

<h1>App Preferences</h1>
<form
	onsubmit={async (e) => {
		const url = URL.parse(vscGqlUrlInput.value);
		e.preventDefault();
		if (!url) {
			console.error('Unexpected: form input should have been prevalidated bc type=url');
			return;
		}
		localStorage.setItem('vsc-gql-url', url.origin);
		await invalidateAll();
		location.reload();
	}}
>
	<label for="vsc-gql-url"></label>
	<input
		id="vsc-gql-url"
		bind:this={vscGqlUrlInput}
		value={(browser && localStorage.getItem('vsc-gql-url')) || 'https://api.vsc.eco'}
		type="url"
	/>
	<PillButton
		styleType="outline"
		onclick={(e) => {
			localStorage.setItem('vsc-gql-url', GQL_URL);
			vscGqlUrlInput.value = GQL_URL;
		}}
		type="button">Reset</PillButton
	>
	<br />
	<PillButton
		styleType="invert"
		theme="primary"
		onclick={() => {
			// intentionally left blank
		}}>Save</PillButton
	>
</form>
