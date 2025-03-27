<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { KeyTypes, type Aioha } from '@aioha/aioha';
	import Input from './Input.svelte';
	import { postingMetadataFromString, type Account, type PostingMetadata } from '../../../lib/auth/hive/accountTypes';

	let { accountInfo, aioha }: { accountInfo?: Account; aioha?: Aioha } = $props();
	let originalPostingMeta = $derived(
		accountInfo ? postingMetadataFromString(accountInfo.posting_json_metadata).profile : undefined
	);
	let midSubmit = $state(false);
	let errorText = $state('');
	let formData = $derived(
		originalPostingMeta ? JSON.parse(JSON.stringify(originalPostingMeta)) : undefined
	);
	$inspect(formData);
	const fields: {
		label: string;
		type?: 'multiline' | 'text' | 'url';
		key: keyof PostingMetadata['profile'];
	}[] = [
		{
			label: 'Display Name',
			key: 'name'
		},
		{
			label: 'Website',
			key: 'website',
			type: 'url'
		},
		{
			label: 'Location',
			key: 'location'
		},
		{
			label: 'About',
			key: 'about',
			type: 'multiline'
		},
		{
			label: 'Profile Picture URL',
			key: 'profile_image',
			type: 'url'
		},
		{
			label: 'Cover Image URL',
			key: 'cover_image',
			type: 'url'
		}
	] as const;
</script>

<form
	onsubmit={async (e) => {
		e.preventDefault();
		if (
			accountInfo == undefined ||
			aioha == undefined ||
			formData == undefined ||
			originalPostingMeta == undefined
		)
			alert("Profile data hasn't loaded yet.");
		const toUpdate: PostingMetadata['profile'] = {} as PostingMetadata['profile'];
		const old = postingMetadataFromString(accountInfo!.posting_json_metadata);
		if (!('profile' in old)) {
			old['profile'] = {} as never;
		}
		let changed = false;
		for (const k in formData) {
			const key = k as keyof PostingMetadata['profile'];
			const orig = originalPostingMeta![key];
			const form = formData[key];
			if (orig != form) {
				changed = true;
				if (form == '') {
					delete old.profile[key];
				} else {
					old.profile[key] = form;
				}
			}
		}
		if (!changed) {
			errorText = 'All the fields below are unedited. Edit';
			return;
		}
		Object.assign(old.profile!, toUpdate);
		midSubmit = true;
		let res = await aioha!.signAndBroadcastTx(
			[
				[
					'account_update2',
					{
						account: aioha!.getCurrentUser(),
						posting_json_metadata: JSON.stringify(old)
					}
				]
			],
			KeyTypes.Posting
		);
		midSubmit = false;
		if (res.success == false) {
			errorText = res.error;
		} else if (accountInfo) {
			accountInfo.posting_json_metadata = JSON.stringify(old);
		}
	}}
>
	<div class="error">
		{#if errorText}
			{errorText}
		{:else}
			&nbsp;
		{/if}
	</div>
	{#each fields as { key, label, type }}
		{#if formData}
			<Input bind:value={formData[key]} {label} {type} loaded={!midSubmit} />
		{:else}
			<Input value={undefined} {label} {type} loaded={false} />
		{/if}
	{/each}
	<br />
	<PillButton theme="primary" styleType="invert" onclick={() => {}}>Update</PillButton>
</form>

<style>
	.error {
		color: var(--secondary-fg-mid);
	}
</style>
