<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	let {
		input = $bindable(),
		label,
		value = $bindable(),
		id,
		...props
	}: HTMLInputAttributes & { input?: HTMLInputElement; label?: string; id: string } = $props();
	let error = $state('');
	const hiveRegex =
		'^(?=.{3,16}$)[a-z][0-9a-z\\-]{1,}[0-9a-z]([.][a-z][0-9a-z\\-]{1,}[0-9a-z]){0,}';
	const evmRegex = '^0x[a-fA-F0-9]{40}$';
	const combinedRegex = `(${hiveRegex})|(${evmRegex})`;
</script>

<label for={id}>{label} Username: </label>
<div class="input-parent">
	<span> @ </span>
	<input
		oninput={() => {
			error = '';
		}}
		oninvalid={(e) => {
			console.log(e);
			if (e.currentTarget.validity.valid == true) {
				error = '';
			} else {
				error = e.currentTarget.validationMessage;
				e.preventDefault();
				e.stopPropagation();
			}
		}}
		bind:this={input}
		bind:value
		{id}
		pattern={props.pattern ?? combinedRegex}
		{...props}
	/>
</div>
<label class="error" for={id}>{error}</label>

<style lang="scss">
	.input-parent {
		font-family: 'Noto Sans Mono Variable', monospace;
		position: relative;
		display: flex;
		align-items: baseline;
		span {
			// @ symbol
			position: absolute;
			top: 50%;
			transform: translateY(-50%);
			left: 0.5rem;
		}
		span:has(+ input:focus-visible) {
			color: var(--primary-fg-mid);
		}
		span:has(+ input:user-invalid) {
			color: var(--secondary-fg-mid);
		}
	}
	input {
		max-width: 16rem;
		width: 100%;
		box-sizing: border-box;
		flex-shrink: 1;
		flex-grow: 0;
		padding-left: 1.5rem;
		position: relative;
		background-color: transparent;
	}
</style>
