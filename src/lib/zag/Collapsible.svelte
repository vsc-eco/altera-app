<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import * as collapsible from '@zag-js/collapsible';
	import { normalizeProps, useMachine } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';

	let {
		children,
		content,
		toggle = $bindable(),
		open = $bindable(),
		initialOpen = false
	}: {
		children: Snippet;
		content: Snippet;
		toggle?: (open?: boolean) => void;
		open?: boolean;
		initialOpen?: boolean;
	} = $props();

	let animating = $state(false);

	const id = $props.id();
	const service = useMachine(collapsible.machine, {
		id,
		defaultOpen: initialOpen,
		onOpenChange(details) {
			animating = true;
			setTimeout(() => {
				animating = false;
			}, 200);
		}
	});
	const api = $derived(collapsible.connect(service, normalizeProps));

	toggle = (open: boolean = false) => {
		api.setOpen(open);
	};
	$effect(() => {
		open = api.open;
	});
</script>

<div {...api.getRootProps()} class={{ animating }}>
	<Card>
		<button {...api.getTriggerProps()}>
			{@render children()}
			{#if api.open}
				<ChevronDown />
			{:else}
				<ChevronRight />
			{/if}
		</button>
		{#if api.open}
			<div class="divider"><hr /></div>
		{/if}
		<div {...api.getContentProps()}>{@render content()}</div>
	</Card>
</div>

<style lang="scss">
	[data-part='root'].animating {
		:global(.card) {
			overflow: hidden;
		}
	}
	[data-part='trigger'] {
		width: 100%;
		color: inherit;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: transparent;
		border: none;
		font: inherit;
		padding: 0;
	}

	.divider {
		padding: 0.5rem 0;
	}

	[data-scope='collapsible'][data-part='content'][data-state='open'] {
		animation: slideDown 200ms ease;
	}

	[data-scope='collapsible'][data-part='content'][data-state='closed'] {
		animation: slideUp 200ms ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0.01;
			height: 0;
		}
		to {
			opacity: 1;
			height: var(--height);
		}
	}

	@keyframes slideUp {
		from {
			opacity: 1;
			height: var(--height);
		}
		to {
			opacity: 0.01;
			height: 0;
		}
	}
</style>
