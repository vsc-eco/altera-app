<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import Balance from '$lib/cards/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { actions } from '../quickActions';
	let username: string | undefined = $state();
	authStore.subscribe((v) => {
		if (v.status == 'authenticated') {
			let u = v.value?.username || v.value?.address;
			if (!u) {
				return;
			}
			if (u.length > 16) {
				username = u.slice(0, 6) + '…' + u.slice(-4);
			} else {
				username = u;
			}
		}
	});
</script>

{#if username}
	<h1>Welcome, {username}</h1>
{:else}
	<div class="h1-placeholder">&nbsp;</div>
{/if}
<div class="action-bar">
	{#each actions as action}
		<PillBtn {...'styling' in action ? action.styling : {}} href={action.href}>
			{@const Icon = action.icon}
			<Icon />
			{action.label}
		</PillBtn>
	{/each}
</div>
<Balance></Balance>

<style>
	h1,
	.h1-placeholder {
		font-size: var(--text-4xl);
		margin: calc(var(--text-4xl) / 2) 0;
	}
	.action-bar {
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		height: 3rem;
		white-space: nowrap;
		position: relative;
	}
	.action-bar::after {
		content: '';
		position: sticky;
		display: block;
		left: calc(100% - 32px);
		bottom: 0;
		width: 32px;
		height: 3rem;
		background: linear-gradient(90deg, transparent, var(--neutral-bg));
	}
</style>
