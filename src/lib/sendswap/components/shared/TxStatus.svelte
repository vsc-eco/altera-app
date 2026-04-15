<script lang="ts">
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { X } from '@lucide/svelte';

	let {
		status = { message: '', isError: false },
		waiting = false,
		abort = () => {},
		showHiveWarning = false
	}: {
		status?: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
		showHiveWarning?: boolean;
	} = $props();

	// Portal action: moves the node out of the current stacking/filter context
	// (the Dialog backdrop uses `backdrop-filter: blur(10px)`, which would
	// otherwise capture any child's backdrop-filter and stack two blurs).
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	// While the waiting overlay is visible, disable the Dialog's own
	// backdrop-filter via a body attribute (see :global rule in <style>).
	$effect(() => {
		if (!waiting) return;
		document.body.setAttribute('data-waiting-signature', '');
		return () => document.body.removeAttribute('data-waiting-signature');
	});
</script>

{#if status.message}
	<div class="status-wrapper">
		<span class="sm-caption">Status</span>
		<p class={{ status: !status.isError, error: status.isError }}>{status.message}</p>
	</div>
{/if}
{#if waiting}
	<div class="waiting-overlay" use:portal>
		<div class="waiting-card">
			<WaveLoading size={32} />
			<div class="info">
				<p>Waiting for signature</p>
				<span>
					<PillButton onclick={() => abort()} theme="secondary" styleType="invert">
						<X /> Cancel
					</PillButton>
				</span>
				{#if showHiveWarning}
					<p class="warning">
						<b class="error">Warning:</b> Transaction may still occur if it is authorized later via your
						hive wallet.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.status-wrapper {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	/* Neutralise the Dialog's own blurred backdrop while the waiting overlay
	   is visible — otherwise the dialog backdrop creates a filter context that
	   makes any child or sibling backdrop-filter look washed out or doubled. */
	:global(body[data-waiting-signature] [data-part='backdrop']) {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
		background-color: transparent !important;
	}

	.waiting-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		pointer-events: auto;
		z-index: 2147483647;
		.waiting-card {
			font-weight: 500;
			padding: 1.75rem 2rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			background: rgba(10, 10, 18, 0.6);
			border: 1px solid var(--dash-card-border);
			border-radius: 27px;
			height: min-content;
			.info {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				.warning {
					max-width: 20rem;
					text-align: center;
				}
			}
		}
	}
</style>
