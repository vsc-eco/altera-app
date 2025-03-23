<script lang="ts">
	import { Search } from '@lucide/svelte';
	import PillButton from './PillButton.svelte';
	import { isMac } from './isMac';

	let input: HTMLInputElement | undefined = $state();
	$effect(() => {
		if (input) {
			let onInput = () => {
				input!.blur();
			};
			input.addEventListener('input', onInput);
			return () => input!.removeEventListener('input', onInput);
		}
	});
</script>

<svelte:document
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key == 'k') {
			e.preventDefault();
			e.stopPropagation();
			input!.focus();
			return false;
		}
	}}
	onkeyup={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key == 'k') {
			e.preventDefault();
			e.stopPropagation();
			input!.focus();
			return false;
		}
	}}
/>

<form
	onsubmit={(e) => {
		e.preventDefault();
		// TODO: Do something here with the submitted value
		input!.value = '';
	}}
>
	<span class="overlay search-icon">
		<Search />
	</span>
	<span class="overlay key-prompt">
		<key>
			{#if isMac == 'unk'}
				&nbsp;
			{:else if isMac}
				⌘
			{:else}
				ctrl
			{/if}
		</key>
		<key>K</key>
	</span>
	<input
		bind:this={input}
		onkeydown={(e) => {
			if (e.key == 'Escape') {
				input!.blur();
			}
		}}
		type="search"
	/>
</form>
<span class="searchBtn">
	<PillButton
		onclick={() => {
			// todo
		}}
		styleType="icon"><Search /></PillButton
	>
</span>

<style>
	.overlay {
		display: block;
		position: absolute;
		top: calc(50%);
		transform: translateY(-50%);
	}
	.key-prompt {
		right: 0.5rem;
		display: inline-flex;
		gap: 0.125rem;
	}

	.search-icon {
		color: var(--neutral-bg-mid);
		left: 0.5rem;
		aspect-ratio: 1;
		pointer-events: none;
	}
	.search-icon :global(svg) {
		width: 16px;
		aspect-ratio: 1;
	}
	.searchBtn {
		display: none;
	}
	@media screen and (max-width: 420px) {
		form {
			display: none;
		}
		.searchBtn {
			display: block;
		}
	}
	form {
		position: relative;
		flex-grow: 1;
	}
	input {
		width: 100%;
		padding-left: calc(16px + 0.75rem);
	}
</style>
