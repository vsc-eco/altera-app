<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import { Check, CircleAlert, X } from '@lucide/svelte';
	import * as dialog from '@zag-js/dialog';
	import { portal, normalizeProps, useMachine } from '@zag-js/svelte';
	import type { Snippet } from 'svelte';
	import type { ImgIconOption } from './ImageIconRenderer.svelte';
	import ImageIconRenderer from './ImageIconRenderer.svelte';

	type Props = {
		children: Snippet;
		confirm: () => void;
		toggle: (open?: boolean) => void;
		customConfirm?: {
			icon: ImgIconOption;
			text: string;
			color: 'primary' | 'secondary';
		};
		customCancel?: {
			icon: ImgIconOption;
			text: string;
		};
	};
	let { children, confirm, toggle = $bindable(), customConfirm, customCancel }: Props = $props();

	let service = useMachine(dialog.machine, {
		id: getUniqueId(),
		closeOnInteractOutside: false,
		onInteractOutside() {
			emphasize = true;
		}
	});
	const api = $derived(dialog.connect(service, normalizeProps));

	toggle = (open: boolean = false) => {
		api.setOpen(open);
	};
	let emphasize = $state(false);
	$effect(() => {
		if (!api.open) {
			emphasize = false;
		}
	});
</script>

<div use:portal {...api.getBackdropProps()}></div>
<div use:portal {...api.getPositionerProps()}>
	<div {...api.getContentProps()} class={{ emphasize }}>
		<Card defaultBg>
			<div class="confirmation-wrapper">
				<div class="warning">
					<CircleAlert color={'var(--secondary-bg-mid)'} />
					{@render children()}
				</div>
				<hr />
				<div class="buttons">
					<PillButton
						onclick={() => {
							toggle();
						}}
					>
						{#if customCancel?.icon}
							<ImageIconRenderer icon={customCancel.icon} />
						{:else}
							<X />
						{/if}
						{customCancel?.text ?? 'Cancel'}
					</PillButton>
					<PillButton
						onclick={() => {
							confirm();
							toggle();
						}}
						theme={customConfirm?.color ?? 'primary'}
						styleType="invert"
					>
						{#if customConfirm?.icon}
							<ImageIconRenderer icon={customConfirm.icon} />
						{:else}
							<Check />
						{/if}
						{customConfirm?.text ?? 'Confirm'}
					</PillButton>
				</div>
			</div>
		</Card>
	</div>
</div>

<style lang="scss">
	hr {
		width: 100%;
	}
	.confirmation-wrapper {
		display: flex;
		flex-direction: column;
		margin: auto;
		min-width: min-content;
		width: min(24rem, calc(100vw - 4rem));
		max-width: 24rem;
		@media screen and (max-width: 24rem) {
			width: calc(100vw - 3.5rem);
		}
	}
	.warning {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		:global(.lucide-icon) {
			min-width: 24px;
		}
	}
	.buttons {
		display: flex;
		justify-content: space-between;
	}
	[data-part='backdrop'] {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 15;
		width: 100%;
		height: 100%;
		/* styles for the backdrop element */
	}
	[data-part='positioner'] {
		border-radius: 0.5rem;
		position: fixed;
		padding: 0.5rem;
		box-sizing: border-box;
		max-width: calc(100% - 0.5rem);
		width: max-content;
		left: 50%;
		top: 50%;
		z-index: 15;
		max-height: calc(100svh - var(--top-offset, 0) * 8);
		transform: translate(-50%, -50%);

		@media screen and (max-width: 450px) {
			width: 100vw;
			height: 100vh;
			max-width: none;
		}
	}
	[data-part='content'] {
		z-index: 15;
		border-radius: 0.5rem;
		&.emphasize {
			border: 2px solid var(--secondary-mid);
		}
	}
</style>
