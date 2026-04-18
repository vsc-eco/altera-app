<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import Qr from '$lib/zag/QR.svelte';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import { login } from './hive';
	import HiveAuthIcon from './hive/HiveAuthIcon.svelte';
	import LedgerIcon from './hive/LedgerIcon.svelte';
	import PeakVaultIcon from './hive/PeakVaultIcon.svelte';
	import { browser } from '$app/environment';
	import Username from './Username.svelte';
	import { untrack } from 'svelte';
	// credit for regex: https://github.com/Mintrawa/hive-username-regex/blob/main/src/index.ts
	const hiveRegex =
		'^(?=.{3,16}$)[a-z][0-9a-z\\-]{1,}[0-9a-z]([.][a-z][0-9a-z\\-]{1,}[0-9a-z]){0,}';
	let input: HTMLInputElement | undefined = $state();
	let close = $state(() => {});
	let authProvider:
		| 'keychain'
		| 'hivesigner'
		| 'hiveauth'
		| 'ledger'
		| 'peakvault'
		| 'metamasksnap'
		| 'custom'
		| undefined = $state();
	let BLANK = '';
	const DEFAULT_METHOD = 'keychain';
	let defaultValue = browser
		? (localStorage?.getItem('default-hive-login-method') ?? DEFAULT_METHOD)
		: DEFAULT_METHOD;
	let defaultUsername = browser ? (localStorage?.getItem('default-hive-login-username') ?? '') : '';
	let usernameErrorText = $state(BLANK);
	let authServiceErrorText = $state(BLANK);
	let aiohaErrorText = $state(BLANK);
	let errorArr = $derived([usernameErrorText, authServiceErrorText, aiohaErrorText]);
	let hasError = $derived(errorArr.some((err) => err != BLANK));

	$effect(() => {
		if (defaultValue && defaultValue !== untrack(() => authProvider)) {
			if (
				[
					'keychain',
					'hivesigner',
					'hiveauth',
					'ledger',
					'peakvault',
					'metamasksnap',
					'custom'
				].includes(defaultValue)
			) {
				authProvider = defaultValue as
					| 'keychain'
					| 'hivesigner'
					| 'hiveauth'
					| 'ledger'
					| 'peakvault'
					| 'metamasksnap'
					| 'custom'
					| undefined;
			}
		}
	});

	function clearErrors() {
		usernameErrorText = '';
		authServiceErrorText = '';
		aiohaErrorText = '';
	}

	let qrData: string | undefined = $state();
	function displayQr(data: string) {
		qrData = data;
	}
	async function loginOnSubmit(event: Event) {
		clearErrors();
		event.preventDefault(); // disables refresh on onsubmit & tooltip oninvalid
		let isValid = true;
		if (!input!.validity.valid) {
			usernameErrorText = input!.validationMessage;
			isValid = false;
		} else {
			usernameErrorText = BLANK;
		}
		let username = input!.value;
		if (authProvider == undefined) {
			authServiceErrorText = 'Authentication Service required.';
			isValid = false;
		} else {
			authServiceErrorText = BLANK;
		}
		let submitBtn = (event.currentTarget as HTMLFormElement).querySelector('button');
		if (isValid == false) {
			return;
		}
		submitBtn!.disabled = true;
		let res = await login(username, authProvider!, displayQr);
		if (!res.success) {
			aiohaErrorText = res.error;
			submitBtn!.disabled = false;
			return;
		}
		clearErrors();
		submitBtn!.disabled = false;
		localStorage.setItem('default-hive-login-method', authProvider!);
		localStorage.setItem('default-hive-login-username', username);
		close();
		return;
	}
</script>

<Dialog bind:toggle={close}>
	Hive Login
	{#snippet title()}
		{#if qrData && !hasError}
			<span class="back-button">
				<PillButton
					styleType="icon-subtle"
					onclick={() => {
						qrData = undefined;
					}}
					><ArrowLeft size="32" />
				</PillButton>
			</span>
		{/if}
		Hive Login
	{/snippet}

	{#snippet content()}
		{#if qrData && !hasError}
			<p>Tap or scan the QR Code below to open the HiveAuth app.</p>

			<Qr data={qrData}></Qr>
		{:else}
			<form onsubmit={loginOnSubmit} oninvalidcapture={loginOnSubmit}>
				<div class="error">{aiohaErrorText}</div>
				<Username
					bind:input
					defaultValue={defaultUsername}
					required
					minlength={3}
					maxlength={16}
					pattern={hiveRegex.toString()}
					id="hive-username-login"
					type="text"
					autocomplete="username"
					placeholder="hiveio"
				/>
				{#snippet keychainLabel()}
					<img src="/hive/keychain.png" width="16" alt="Keychain Icon" /> Hive Keychain
				{/snippet}
				{#snippet hiveAuthLabel()}
					<HiveAuthIcon />
					Hive Auth
				{/snippet}
				{#snippet hiveLedgerLabel()}
					<LedgerIcon />
					Hive Ledger
				{/snippet}
				{#snippet peakVaultLabel()}
					<PeakVaultIcon />
					Peak Vault
				{/snippet}
				{#snippet metamaskSnapLabel()}
					<span class="metamask-dot" aria-hidden="true"></span>
					MetaMask Snap
				{/snippet}
				<RadioGroup
					id="hive-auth-method-login"
					name="Sign in with:"
					items={[
						{ snippet: keychainLabel, value: 'keychain' },
						// { label: 'Hive Signer', value: 'hivesigner' },
						{ snippet: hiveAuthLabel, value: 'hiveauth' },
						{ snippet: hiveLedgerLabel, value: 'ledger' },
						{ snippet: peakVaultLabel, value: 'peakvault' },
						{ snippet: metamaskSnapLabel, value: 'metamasksnap' }
					]}
					{defaultValue}
					bind:value={authProvider}
				></RadioGroup>
				<label class="error" for="hive-auth-method-login">{authServiceErrorText}</label>
				<PillButton
					onclick={() => {
						// explicitly doesn't do anything;
						// instead relies on parent form's submit event
					}}
					type="submit"
					theme="primary"
					styleType="invert">Login</PillButton
				>
			</form>
		{/if}
	{/snippet}
</Dialog>

<style lang="scss">
	form :global(label) {
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
		display: flex;
		width: max-content;
		align-items: center;
	}
	label {
		margin-left: 0.25rem;
		color: var(--dash-text-secondary);
	}
	.error {
		min-height: 1em;
		margin-top: 0.25rem;
	}
	.metamask-dot {
		display: inline-block;
		width: 16px;
		height: 16px;
		border-radius: 4px;
		background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
		margin-right: 0.25rem;
	}
	/* Constrain the Hive login provider radio grid to max 3 items per row. */
	form :global(.items) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	form :global(.items > *) {
		width: auto;
		min-width: 0;
	}
</style>
