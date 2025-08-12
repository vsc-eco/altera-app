<script lang="ts">
	import PillButton, { type ButtonAttributes } from '$lib/PillButton.svelte';
	import { PenLine, Save, X } from '@lucide/svelte';
	import * as editable from '@zag-js/editable';
	import { useMachine, normalizeProps } from '@zag-js/svelte';

	let {
		value = $bindable(),
		defaultValue,
		alwaysShow,
		disabled = false,
		maxLength
	}: {
		value: string | undefined;
		defaultValue?: string;
		alwaysShow?: string;
		disabled?: boolean;
		maxLength?: number;
	} = $props();

	const id = $props.id();
	const service = useMachine(editable.machine, {
		id,
		autoResize: true,
		defaultValue: value,
		activationMode: 'click',
		disabled: disabled,
		placeholder: defaultValue,
		submitMode: 'both',
		onValueCommit(details) {
			value = details.value;
		}
	});
	const api = $derived(editable.connect(service, normalizeProps));
</script>

<div {...api.getRootProps()}>
	<div {...api.getAreaProps()}>
		<input {...api.getInputProps()} maxlength={maxLength} />
		<span {...api.getPreviewProps()}>{api.valueText + (alwaysShow ?? '  ')}</span>
	</div>
	<div class="buttons">
		<span class:hidden={api.editing}>
			<PillButton {...api.getEditTriggerProps() as ButtonAttributes} styleType="icon-subtle">
				<PenLine size="20" />
			</PillButton>
		</span>
		<span class:hidden={!api.editing}>
			<PillButton {...api.getSubmitTriggerProps() as ButtonAttributes} styleType="icon-subtle">
				<Save size="20" />
			</PillButton>
		</span>
		<span class:hidden={!api.editing}>
			<PillButton {...api.getCancelTriggerProps() as ButtonAttributes} styleType="icon-subtle">
				<X size="20" />
			</PillButton>
		</span>
	</div>
</div>

<style lang="scss">
	[data-part='root'] {
		display: flex;
	}
	[data-part='input'] {
		height: 1.5rem;
		border: none;
		border-bottom: 1px solid var(--primary-bg-mid);
		box-shadow: none;
		// box-sizing: border-box;
	}
	[data-part='preview'] {
		align-self: flex-end;
	}
	.buttons {
		display: flex;
		align-items: flex-end;
		:global(button) {
			margin-top: 0;
			margin-bottom: 0;
		}
	}
	.hidden {
		display: none;
	}
</style>
