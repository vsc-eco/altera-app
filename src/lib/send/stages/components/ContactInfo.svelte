<script lang="ts">
	import { getUsernameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { Dot } from '@lucide/svelte';
	import InfoSegment from './InfoSegment.svelte';
	import type { Contact } from '$lib/send/contacts/contacts';

	let {
		did,
		accounts,
		showSelected = false,
		name,
		icon,
		lastPaid,
		detailed = true,
		warning,
		size = 'small'
	}: {
		did?: string;
		accounts: Contact['addresses'];
		showSelected?: boolean;
		name?: string;
		icon?: string;
		lastPaid?: string;
		detailed?: boolean;
		warning?: string;
		size?: 'small' | 'medium' | 'large';
	} = $props();
	const username = $derived(did ? getUsernameFromDid(did) : undefined);

	const numAddresses = $derived.by(() => {
		let res = '';
		if (accounts.length === 0) {
			res = 'No Accounts Available';
		} else if (accounts.length === 1) {
			res = '1 Account Available';
		} else {
			res = `${accounts.length} Accounts Available`;
		}
		if (!showSelected || !did) return res;
		const selected = accounts.find((acc) => acc.address === getUsernameFromDid(did));
		if (selected && selected.label) {
			res = res.concat(` - ${selected.label} Selected`);
		}
		return res;
	});
	let display = $derived.by(() => {
		if (!detailed) return [];
		if (warning) return [warning];
		let result = [numAddresses];
		if (lastPaid) {
			result.push(`Last paid ${lastPaid}`);
		}
		return result;
	});
</script>

<div class={['wrapper', { gray: warning }]}>
	{#if icon}
		<img src={icon} alt="Contact" />
	{:else}
		<Avatar {did} large={size === 'large'} />
	{/if}
	<InfoSegment label={name ?? username ?? ''} {display} disabled={warning !== undefined} {size} />
</div>

<style lang="scss">
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
		img {
			width: 3.5rem;
			border-radius: 100%;
		}
	}
	.wrapper.gray {
		:global(img) {
			filter: grayscale(100%);
		}
	}
</style>
