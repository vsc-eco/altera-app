import { ArrowRightLeft, Coins, Droplets, Eye, LayoutDashboard, ScrollText, Send, Store } from '@lucide/svelte';

export type SidebarPath = {
	name: string;
	icon: typeof LayoutDashboard;
	href: string;
	requiresHive?: boolean;
};

export const paths: SidebarPath[] = [
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
		name: 'Cross-chain Swaps',
		icon: ArrowRightLeft,
		href: '/swap'
	},
	{
		name: 'Pools',
		icon: Droplets,
		href: '/swap?tab=pools'
	},
	{ name: 'Witness Assistant', icon: Eye, href: '/witness-assistant' },
	{
		name: 'Magi Tokens / NFTs',
		icon: Coins,
		href: '/custom-tokens',
		requiresHive: true
	},
	{
		name: 'NFT Market',
		icon: Store,
		href: '/market',
		requiresHive: true
	}
];
