<script lang="ts">
	import type { SharedProps } from '$lib/PillButton.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import StakePopup from '$lib/magiTransactions/hive/vscOperations/StakePopup.svelte';
	import { Banknote, Component, LockKeyhole, Send } from '@lucide/svelte';
	import { actions, type NavigationAction } from '../quickActions';
	import type { Auth } from '$lib/auth/store';
	import QuickSend from '$lib/sendswap/QuickSend.svelte';
	import { blankDetails, getTxSessionId, SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import Deposit from '$lib/sendswap/Deposit.svelte';
	let { auth }: { auth: Auth } = $props();
	type PopupAction = {
		type: 'popup';
		label: string;
		onclick: () => void;
		icon: typeof Component;
		styling?: SharedProps;
	};
	let stakeOpen = $state(false);
	let toggleStake = $state((open?: boolean) => {
		stakeOpen = open !== undefined ? open : !stakeOpen;
	});
	let quickSendOpen = $state(false);
	let sendSessionId = $state(getTxSessionId());
	let depositSessionId = $state(getTxSessionId());
	let toggleQuickSend = $state<(open?: boolean) => void>(() => {});
	let depositOpen = $state(false);
	let toggleDeposit = $state<(open?: boolean) => void>(() => {});
	const menuActions: (NavigationAction | PopupAction)[] = [
		{
			type: 'popup',
			label: 'Quick Send',
			onclick: () => {
				sendSessionId = getTxSessionId();
				toggleQuickSend(true);
			},
			icon: Send,
			styling: {
				theme: 'primary',
				styleType: 'invert'
			}
		},
		{
			type: 'popup',
			label: 'Deposit',
			onclick: () => {
				depositSessionId = getTxSessionId();
				toggleDeposit(true);
			},
			icon: Banknote
		},
		...actions.filter((action) => action.label === 'Swap'),
		{
			type: 'popup',
			label: 'Staking',
			onclick: () => toggleStake(true),
			icon: LockKeyhole
		}
	];
</script>

<div class="action-bar" tabindex="-1">
	{#each menuActions as action}
		<PillBtn
			{...'styling' in action ? action.styling : {}}
			{...'href' in action ? { href: action.href } : { onclick: action.onclick }}
		>
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>

<StakePopup {auth} bind:dialogOpen={stakeOpen} bind:toggle={toggleStake} />
<QuickSend
	bind:dialogOpen={quickSendOpen}
	bind:toggle={toggleQuickSend}
	sessionId={sendSessionId}
/>
<Deposit bind:dialogOpen={depositOpen} bind:toggle={toggleDeposit} sessionId={depositSessionId} />

<style>
	.action-bar {
		max-width: 100%;
		overflow-x: auto;
		padding-top: 2px;
		height: 3.5rem;
		white-space: nowrap;
		position: relative;
	}
	/* .action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3.5rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
	} */
</style>
