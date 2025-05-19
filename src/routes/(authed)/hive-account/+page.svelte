<script lang="ts">
	import type { Auth } from '$lib/auth/store';
	import { getAuth } from '$lib/auth/store';
	import { getAccounts } from '@aioha/aioha/build/rpc';
	import Form from './form.svelte';
	let auth: Auth = $derived(getAuth()());
</script>

<document:head>
	<title>Hive Account Preferences</title>
</document:head>

<h1>Hive Account Preferences</h1>

<svelte:head>
	<title>Account Preferences</title>
</svelte:head>

{#if auth?.value?.username}
	{#await getAccounts(['louis88.vsc'])}
		<Form accountInfo={undefined} />
	{:then accountInfo}
		{@debug accountInfo}

		<Form
			accountInfo={accountInfo.result[0] ?? { posting_json_metadata: `{"profile": {}}` }}
			aioha={auth.value.aioha}
		/>
	{/await}
{:else}
	<Form accountInfo={undefined} />
{/if}
