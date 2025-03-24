import { ArrowRightLeft, Home, ScrollText } from '@lucide/svelte';

export const paths = [
	{
		name: 'Home',
		icon: Home,
		href: '/'
	},
	{
		name: 'Transactions',
		icon: ScrollText,
		href: '/transactions'
	},
	{
		name: 'Swap',
		icon: ArrowRightLeft,
		href: '/swap'
	}
];
