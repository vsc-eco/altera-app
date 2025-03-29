<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	let {
		input = $bindable(),
		label,
		value = $bindable(),
		id,
		...props
	}: HTMLInputAttributes & { input?: HTMLInputElement; label?: string; id: string } = $props();
</script>

<label for={id}>{label} Username: </label>
<div class="input-parent">
	<span> @ </span>
	<input bind:this={input} bind:value {id} {...props} />
</div>

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
		flex-shrink: 1;
		flex-grow: 0;
		padding-left: 1.5rem;
		position: relative;
		background-color: transparent;
	}
</style>
