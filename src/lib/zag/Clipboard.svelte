<script lang="ts">
	import * as clipboard from '@zag-js/clipboard';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { ClipboardCheck, ClipboardCopyIcon } from '@lucide/svelte';
	import { getUniqueId } from './idgen';
	import PillButton from '$lib/PillButton.svelte';
	let { label, value, disabled = false } = $props();
	const service = useMachine(clipboard.machine, {
		id: getUniqueId(),
		value
	});

	const api = $derived(clipboard.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()} class:disabled>
	{#if label}
		<label {...api.getLabelProps()}>{label}</label>
	{/if}
	<div {...api.getControlProps()}>
		<input {...api.getInputProps()} {disabled} readonly />
		<PillButton
			{...api.getTriggerProps()}
			onclick={api.getTriggerProps().onclick!}
			styleType="icon-text"
		>
			{#if api.copied && !disabled}
				<ClipboardCheck class="clipboard-icon"/>
			{:else}
				<ClipboardCopyIcon class="clipboard-icon"/>
			{/if}
		</PillButton>
	</div>
</div>

<style>
	[data-part='control'] {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}
	input {
		text-overflow: ellipsis;
		min-width: 12ch;
		width: 100%;
		font-family: 'Noto Sans Mono Variable', monospace;
	}
	[data-part='label'] {
		margin-bottom: 0;
	}

	.disabled {
		filter: grayscale(50%);
	}
	
	.disabled input {
		color: var(--neutral-mid);
	}
	
	.disabled [data-part='control'] {
		pointer-events: none;
	}

	.disabled :global(.clipboard-icon) {
		opacity: 0.5;
		filter: brightness(0.7);
	}
</style>
