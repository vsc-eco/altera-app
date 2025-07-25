<script lang="ts">
	import Dialog from '$lib/zag/Dialog.svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import { blankDetails, getDisplayName, getTxSessionId, SendTxDetails } from '../sendUtils';
	import Complete from '../stages/complete/Complete.svelte';
	import Review from '../stages/review/Review.svelte';
	import SelectOptions from './SelectOptions.svelte';
	import * as steps from '@zag-js/steps';
	import { useMachine, normalizeProps } from '@zag-js/svelte';
	import { authStore, type Auth } from '$lib/auth/store';
	import SendNavButtons from '../navigation/SendNavButtons.svelte';
	import { untrack } from 'svelte';
	import { getUsernameFromDid } from '$lib/getAccountName';
	import { Network } from '../sendOptions';

	let { dialogOpen = $bindable(), toggle = $bindable()} = $props<{
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
	}>();

	const auth = $authStore;

	let sessionId = $state(getTxSessionId());
	SendTxDetails.set(blankDetails());

	const stepsData = [
		{ value: 'options', content: options },
		{ value: 'review', label: 'Review', content: review },
		{ value: 'complete', label: 'Review', content: complete }
	];

	const id = getUniqueId();
	const service = useMachine(steps.machine, {
		id,
		orientation: 'vertical',
		// linear: true,
		count: stepsData.length - 1
	});
	const api = $derived(steps.connect(service, normalizeProps));

	$effect(() => {
		const did = auth.value?.did;
		untrack(() => {
			if (!did) return;
			getDisplayName(did).then((displayName) => {
				SendTxDetails.update((current) => ({
					...current,
					toDisplayName: displayName ?? getUsernameFromDid(auth.value!.did),
					toUsername: getUsernameFromDid(auth.value!.did),
					toNetwork: Network.vsc
				}));
			});
		});
	});

	let stage = new Set<string>();
	let stepComplete = $state(false);
	function editStage(id: string, add: boolean) {
		if (add) {
			stage.add(id);
		} else {
			stage.delete(id);
		}
		for (const val of stage) {
			let i = stepsData.findIndex((step) => step.value === val);
			if (i === api.value) {
				stepComplete = true;
				return;
			}
		}
		stepComplete = false;
	}

	function next() {
		// if (api.value === api.count) {
		// 	goto('/transactions');
		// } else if (stepsData[api.value].value === 'review') {
		// 	editStage(stepsData[stepsData.length - 1].value, true);
		// 	setStatus('');
		// 	initSwap();
		// } else {
		// 	api.goToNextStep();
		// }
	}
	function previous() {
		// if (txId) {
		// 	txId = '';
		// }
		if (api.value === 0) {
			toggle(false);
		} 
		// else if (api.value === api.count) {
		// 	api.setStep(0);
		// 	sessionId = getTxSessionId();
		// 	SendTxDetails.set(blankDetails());
		// } else {
		// 	api.goToPrevStep();
		// 	setStatus('');
		// }
	}

	const nextLabel = $derived(
		stepsData[api.value].value === 'review'
			? 'Send'
			: api.value === stepsData.length - 1
				? 'Done'
				: 'Next'
	);
	const buttons = $derived({
		fwd: {
			label: nextLabel,
			action: next,
			disabled: !stepComplete
		},
		back: {
			label: 'Back',
			action: previous
		}
	});
</script>

{#snippet options(value: string)}
	<SelectOptions />
{/snippet}

{#snippet review(value: string)}
	<!-- <Review /> -->
{/snippet}

{#snippet complete()}
	<!-- <Complete /> -->
{/snippet}

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#key sessionId}
			<div {...api.getRootProps()}>
				{#each stepsData as step, index}
					<div {...api.getContentProps({ index })}>
						{@render step.content(step.value)}
					</div>
				{/each}
			</div>
		{/key}
		<SendNavButtons {buttons} small={true} />
	{/snippet}
</Dialog>

<style lang="scss">
	[data-part='root'] {
		display: flex;
	}
	[data-part='content'] {
		width: 32rem;
		min-width: min-content;
	}
</style>
