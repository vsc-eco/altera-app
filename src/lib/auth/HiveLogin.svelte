<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SegmentedControl from '$lib/zag/RadioGroup.svelte';
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
	let errorTxt = $state('');
	async function loginOnSubmit(event: Event) {
		event.preventDefault(); // disables refresh on onsubmit & tooltip oninvalid
		if (!input!.validity.valid) {
			errorTxt = input!.validationMessage;
			return;
		}
		let username = input!.value;
		console.log(authProvider);
		if (authProvider == undefined) {
			errorTxt = 'Authentication Service required.';
			return;
		}
		let res = await login(username, authProvider);
		if (res.success) {
			errorTxt = '';
			close();
			return;
		}
		errorTxt = res.error;
	}
</script>

<Dialog bind:close>
	Hive Login
	{#snippet title()}
		Hive Login
	{/snippet}

	{#snippet content()}
		<form onsubmit={loginOnSubmit} oninvalidcapture={loginOnSubmit}>
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
			<div class="error">{errorTxt}</div>
			<SegmentedControl
				name="Authentication Service"
				items={[
					{ label: 'Hive Keychain', value: 'keychain' },
					{ label: 'Hive Signer', value: 'hivesigner' },
					{ label: 'Hive Auth', value: 'hiveauth' },
					{ label: 'Hive Ledger', value: 'ledger' },
					{ label: 'Peak Vault', value: 'peakvault' }
				]}
				bind:value={authProvider}
			></SegmentedControl>
			<PillButton
				onclick={() => {
					// explicitly doesn't do anything;
					// instead relies on parent form's submit event
				}}
				type="submit">Login</PillButton
			>
		</form>
	{/snippet}
</Dialog>

<style lang="scss">
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
			color: var(--secondary-fg-mid);
		}
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
