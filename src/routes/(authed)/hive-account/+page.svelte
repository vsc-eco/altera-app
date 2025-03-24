<script lang="ts">
	import type { Auth } from '$lib/auth/store';
	import { authStore } from '$lib/auth/store';
	import { getAccounts } from '@aioha/aioha/build/rpc';
	import Form from './form.svelte';
	let auth: Auth | undefined = undefined;
	authStore.subscribe((v) => {
		if (v.status == 'authenticated') {
			auth = v;
		}
	});
</script>

<document:head>
	<title>Hive Account Preferences</title>
</document:head>

<h1>Hive Account Preferences</h1>

<svelte:head>
	<title>Account Preferences</title>
</svelte:head>

{#if auth?.value?.username}
	{#await getAccounts([auth.value.username])}
		<Form accountInfo={undefined} />
	{:then accountInfo}
		<Form accountInfo={accountInfo.result[0]!} aioha={auth.value.aioha} />
	{/await}
{:else}
	<Form accountInfo={undefined} />
{/if}
