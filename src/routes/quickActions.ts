import type { SharedProps } from '$lib/PillButton.svelte';
import { ArrowRightLeft, Component, Send } from '@lucide/svelte';

export type NavigationAction = {
	type: 'navigation';
	label: string;
	href: string;
	icon: typeof Component;
	styling?: SharedProps;
};

export const actions: NavigationAction[] = [
	{
		type: 'navigation',
		label: 'Send',
		href: '/send',
		icon: Send,
		styling: {
			theme: 'primary',
			styleType: 'invert'
		}
	},
	// {
	// 	label: 'Receive',
	// 	href: '/receive',
	// 	icon: HandCoins
	// },
	// {
	// 	label: 'Deposit',
	// 	href: '/deposit',
	// 	icon: PiggyBank
	// },
	{
		type: 'navigation',
		label: 'Swap',
		href: '/swap',
		icon: ArrowRightLeft
	}
];
