<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import Qr from '$lib/zag/QR.svelte';
	import SegmentedControl from '$lib/zag/RadioGroup.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import { login } from './hive';
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
	let BLANK = '\n';
	let usernameErrorText = $state(BLANK);
	let authServiceErrorText = $state(BLANK);
	let aiohaErrorText = $state(BLANK);
	let errorArr = $derived([usernameErrorText, authServiceErrorText, aiohaErrorText]);
	function clearErrors() {
		for (let i = 0; i < errorArr.length; i++) {
			errorArr[i] = BLANK;
		}
	}
	let hasError = $derived(errorArr.some((err) => err != BLANK));
	let qrData: string | undefined = $state();
	function displayQr(data: string) {
		qrData = data;
	}
	async function loginOnSubmit(event: Event) {
		clearErrors();
		event.preventDefault(); // disables refresh on onsubmit & tooltip oninvalid
		if (!input!.validity.valid) {
			usernameErrorText = input!.validationMessage;
			return;
		} else {
			usernameErrorText = BLANK;
		}
		let username = input!.value;
		console.log(authProvider);
		if (authProvider == undefined) {
			authServiceErrorText = 'Authentication Service required.';
			return;
		} else {
			authServiceErrorText = BLANK;
		}
		let submitBtn = (event.currentTarget as HTMLFormElement).querySelector('button');
		submitBtn!.disabled = true;
		let res = await login(username, authProvider, displayQr);
		if (!res.success) {
			aiohaErrorText = res.error;
			submitBtn!.disabled = false;
			return;
		}
		clearErrors();
		submitBtn!.disabled = false;
		close();
		return;
	}
</script>

<Dialog bind:close>
	Hive Login
	{#snippet title()}
		Hive Login
	{/snippet}

	{#snippet content()}
		{#if qrData && !hasError}
			<span class="back-button">
				<PillButton
					styleType="icon"
					onclick={() => {
						qrData = undefined;
					}}
					><ArrowLeft></ArrowLeft>
				</PillButton>
			</span>
			<p>Tap or scan the QR Code below to open the HiveAuth app</p>
			<a href={qrData}>
				<Qr data={qrData}></Qr>
			</a>
		{:else}
			<form onsubmit={loginOnSubmit} oninvalidcapture={loginOnSubmit}>
				<div class="error">{aiohaErrorText}</div>
				<label for="hive-username-login"> Username: </label>
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
				</div>
				<br />
				<label class="error" for="hive-username-login">{usernameErrorText}</label>
				<SegmentedControl
					id="hive-auth-method-login"
					name="Sign in with:"
					items={[
						{ label: 'Hive Keychain', value: 'keychain' },
						{ label: 'Hive Signer', value: 'hivesigner' },
						{ label: 'Hive Auth', value: 'hiveauth' },
						{ label: 'Hive Ledger', value: 'ledger' },
						{ label: 'Peak Vault', value: 'peakvault' }
					]}
					bind:value={authProvider}
				></SegmentedControl>
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
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		max-width: 300px;
	}
	label {
		margin-top: 0.5rem;
		display: flex;
		width: max-content;
		align-items: center;
	}
	label * {
		flex-basis: max-content;
	}
	.error {
		color: var(--secondary-mid);
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
		top: 0.5rem;
		left: 1rem;
	}
	input {
		flex-shrink: 1;
		flex-grow: 0;
		font-size: var(--text-sm);
		padding-left: 1.5rem;
		position: relative;
		background-color: transparent;
	}
</style>
