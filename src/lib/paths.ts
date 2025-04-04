import { ArrowRightLeft, Eye, Home, ScrollText } from '@lucide/svelte';

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
		name: 'Send',
		icon: ArrowRightLeft,
		href: '/send'
	},
	{ name: 'Witness Assistant', icon: Eye, href: '/witness-assistant' }
];
