<script lang="ts">
	let {
		label,
		value = $bindable(),
		loaded,
		type
	}: {
		label: string;
		value?: string | number;
		loaded: boolean;
		type?: 'multiline' | 'text' | 'url';
	} = $props();
	let id = $derived('hive-' + label.toLocaleLowerCase().replace(' ', '-'));
	console.log(type);
</script>

<label for={id}>{label}</label>
{#if type == 'url'}
	<input {id} bind:value type="url" disabled={!loaded} />
{:else if type == 'multiline'}
	<textarea {id} bind:value disabled={!loaded}></textarea>
{:else}
	<input {id} bind:value disabled={!loaded} />
{/if}

<style>
	label {
		margin-bottom: 0.5rem;
		margin-top: 1rem;
		display: block;
		margin-left: 0.25rem;
		font-size: var(--text-sm);
	}
	input,
	textarea {
		padding-left: 0.5rem;
		width: 100%;
		max-width: 24rem;
		box-sizing: border-box;
	}
	textarea {
		height: 6rem;
		display: block;
		font: inherit;
		color: inherit;
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		resize: none;
		padding: 0.5rem;
		box-sizing: border-box;
		background-color: transparent;
	}

	textarea:focus-visible {
		box-shadow: 0 -2px inset var(--primary-bg-mid);
		border-radius: 0.5rem 0.5rem 0 0;
		outline: none;
	}

	textarea:disabled {
		background-color: var(--neutral-bg-accent);
	}
</style>
