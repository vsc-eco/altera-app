<script lang="ts">
	import * as clipboard from '@zag-js/clipboard';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { ClipboardCheck, ClipboardCopyIcon } from '@lucide/svelte';
	import { getUniqueId } from './idgen';
	import PillButton from '$lib/PillButton.svelte';
	let { label, value } = $props();
	const service = useMachine(clipboard.machine, {
		id: getUniqueId(),
		value
	});

	const api = $derived(clipboard.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<label {...api.getLabelProps()}>{label}</label>
	<div {...api.getControlProps()}>
		<input {...api.getInputProps()} />
		<PillButton
			{...api.getTriggerProps()}
			onclick={api.getTriggerProps().onclick!}
			styleType="icon-outline"
		>
			{#if api.copied}
				<ClipboardCheck />
			{:else}
				<ClipboardCopyIcon />
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
	}
	[data-part='label'] {
		margin-bottom: 0;
	}
</style>
