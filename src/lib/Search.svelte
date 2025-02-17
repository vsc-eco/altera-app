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
		color: inherit;
		font: inherit;
		width: 100%;
		margin: 0.5rem 0.1rem;
		height: 32px;
		border: 1px solid var(--neutral-bg-accent);
		background-color: var(--neutral-bg);
		border-radius: 0.25rem;
	}
	input:focus-visible {
		border-bottom: 2px solid var(--primary-bg-mid);
		outline: none;
		border-radius: 0.25rem 0.25rem 0 0;
	}
</style>
