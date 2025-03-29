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
	import HiveUsername from './Username.svelte';
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
		| 'custom'
		| undefined = $state();
	let BLANK = '';
	const DEFAULT_METHOD = 'keychain';
	let defaultValue = browser
		? (localStorage?.getItem('default-hive-login-method') ?? DEFAULT_METHOD)
		: DEFAULT_METHOD;
	let usernameErrorText = $state(BLANK);
	let authServiceErrorText = $state(BLANK);
	let aiohaErrorText = $state(BLANK);
	let errorArr = $derived([usernameErrorText, authServiceErrorText, aiohaErrorText]);
	let hasError = $derived(errorArr.some((err) => err != BLANK));

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
		close();
		return;
	}
</script>

<Dialog bind:toggle={close}>
	Hive Login
	{#snippet title()}
		Hive Login
	{/snippet}

	{#snippet content()}
		{#if qrData && !hasError}
			<span class="back-button">
				<PillButton
					styleType="icon-outline"
					onclick={() => {
						qrData = undefined;
					}}
					><ArrowLeft></ArrowLeft>
				</PillButton>
			</span>
			<p>Tap or scan the QR Code below to open the HiveAuth app.</p>
			<a href={qrData}>
				<Qr data={qrData}></Qr>
			</a>
		{:else}
			<form onsubmit={loginOnSubmit} oninvalidcapture={loginOnSubmit}>
				<div class="error">{aiohaErrorText}</div>
				<!-- <label for="hive-username-login"> Username: </label>
				<div class="input-parent">
					<span>@</span>
					<input
						bind:this={input}
						required
						minlength="3"
						maxlength="16"
						pattern={hiveRegex.toString()}
						id="hive-username-login"
						type="text"
						size="17"
						autocomplete="username"
						placeholder="hiveio"
					/>
				</div> -->
				<HiveUsername
					bind:input
					required
					minlength={3}
					maxlength={16}
					pattern={hiveRegex.toString()}
					id="hive-username-login"
					type="text"
					size={17}
					autocomplete="username"
					placeholder="hiveio"
				/>
				<label class="error" for="hive-username-login">{usernameErrorText}</label>
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
				<RadioGroup
					id="hive-auth-method-login"
					name="Sign in with:"
					items={[
						{ snippet: keychainLabel, value: 'keychain' },
						// { label: 'Hive Signer', value: 'hivesigner' },
						{ snippet: hiveAuthLabel, value: 'hiveauth' },
						{ snippet: hiveLedgerLabel, value: 'ledger' },
						{ snippet: peakVaultLabel, value: 'peakvault' }
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
	a {
		display: contents;
	}
	form :global(label) {
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
		display: flex;
		width: max-content;
		align-items: center;
	}
	label {
		margin-left: 0.25rem;
		color: var(--primary-fg-mid);
	}
	.error {
		color: var(--secondary-fg-mid);
		min-height: 1em;
		margin-top: 0.25rem;
	}
	.input-parent {
		font-family: 'Noto Sans Mono Variable', monospace;
		position: relative;
		display: flex;
		align-items: baseline;
		span {
			// @ symbol
			position: absolute;
			top: 50%;
			transform: translateY(-50%);
			left: 0.5rem;
		}
		span:has(+ input:focus-visible) {
			color: var(--primary-fg-mid);
		}
		span:has(+ input:user-invalid) {
			color: var(--secondary-fg-mid);
		}
	}
	.back-button {
		display: inline-block;
		position: absolute;
		top: 1rem;
		left: 1.5rem;
	}
	input {
		flex-shrink: 1;
		flex-grow: 0;
		padding-left: 1.5rem;
		position: relative;
		background-color: transparent;
	}
</style>
