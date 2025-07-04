import { ArrowRightLeft, Eye, Home, ScrollText, Send } from '@lucide/svelte';

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
	// {
	// 	name: 'Send',
	// 	icon: Send,
	// 	href: '/send'
	// },
	{
		name: 'Swap',
		icon: ArrowRightLeft,
		href: '/swap'
	},
	{ name: 'Witness Assistant', icon: Eye, href: '/witness-assistant' }
];
