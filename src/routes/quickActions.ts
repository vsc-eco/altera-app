import type { SharedProps } from '$lib/PillButton.svelte';
import { ArrowRightLeft, Component, Send } from '@lucide/svelte';

export const actions: {
	label: string;
	href: string;
	icon: typeof Component;
	styling?: SharedProps;
}[] = [
	{
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
		label: 'Swap',
		href: '/swap',
		icon: ArrowRightLeft
	}
];
