import { ArrowRightLeft, Eye, LayoutDashboard, ScrollText, Send } from '@lucide/svelte';

export const paths = [
	{
		name: 'Dashboard',
		icon: LayoutDashboard,
		href: '/'
	},
	{
		name: 'Transactions',
		icon: ScrollText,
		href: '/transactions'
	},
	{
		name: 'Transfer',
		icon: Send,
		href: '/transfer'
	},
	{
		name: 'Swap',
		icon: ArrowRightLeft,
		href: '/swap'
	},
	{ name: 'Witness Assistant', icon: Eye, href: '/witness-assistant' }
];
