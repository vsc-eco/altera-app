<script>
	let input = $state();
	$effect(() => {
		if (input) {
			let abort = new AbortController();
			input.addEventListener(
				'search',
				() => {
					input.blur();
				},
				{ abort }
			);
			return () => abort.abort();
		}
	});
</script>

<svelte:document
	onkeydown={(e) => {
		if (e.metaKey && e.key == 'k') {
			input.focus();
		}
	}}
/>

<form
	onsubmit={(e) => {
		e.preventDefault();
		// TODO: Do something here with the submitted value
		input.value = '';
	}}
>
	<input
		bind:this={input}
		onkeydown={(e) => {
			if (e.key == 'Escape') {
				input.blur();
			}
		}}
		type="search"
	/>
</form>

<style>
	form {
		flex-grow: 1;
	}
	input {
		width: 100%;
	}
</style>
