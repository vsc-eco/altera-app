<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { LabelHint } from '$lib/ui';
	import {
		keyHiveApiAllowBackups,
		keyHiveApiList,
		keyHiveNetworkId
	} from '$lib/magiTransactions/dhive';
	import PillButton from '$lib/PillButton.svelte';
	import {
		DEFAULT_GQL_URL,
		DEFAULT_MAGI_INDEXER_URL,
		keyVscGql,
		keyVscNetworkId,
		keyMagiIndexer,
		keyTests,
		keyTbd
	} from '../../../client';
	import ToggleTheme from './ToggleTheme.svelte';
	import {
		autoSelectedNodeUrl,
		isManualMode,
		MODE_KEY,
		type Category
	} from '$lib/nodeSelection/select';

	// "Custom" = manual override of the dynamic node-finder. Unchecked = auto
	// selection (textbox disabled). isManualMode also covers legacy users
	// (custom key set, no explicit mode key).
	function initCustom(cat: Category): boolean {
		if (!browser) return false;
		return isManualMode(cat);
	}
	let customVsc = $state(initCustom('vsc'));
	let customIndexer = $state(initCustom('indexer'));
	let customHive = $state(initCustom('hive'));

	const DEFAULT_HIVE_API_URL = 'https://api.hive.blog';
	const DEFAULT_VSC_NETWORK_ID = 'vsc-mainnet';
	const DEFAULT_HIVE_ASSET_NAME = 'HIVE';
	const DEFAULT_HBD_ASSET_NAME = 'HBD';

	let vscGqlUrlInput: HTMLInputElement = $state()!;
	let magiIndexerInput: HTMLInputElement = $state()!;
	let hiveApiUrlInput: HTMLInputElement = $state()!;
	let hiveAllowBackupsCheckbox: HTMLInputElement = $state()!;
	let vscNetworkIdInput: HTMLInputElement = $state()!;
	let hiveNetworkIdInput: HTMLInputElement = $state()!;
	let testsInput: HTMLInputElement = $state()!;
	let tbdInput: HTMLInputElement = $state()!;

	let advancedOptions = $state(false);
</script>

<h1>App Preferences</h1>
<div class="sections">
	<form
		onsubmit={async (e) => {
			e.preventDefault();
			// Use defaults when field is left empty (HIVE Custom Network ID stays empty if not set)
			const vscUrlStr = vscGqlUrlInput.value.trim() || DEFAULT_GQL_URL;
			const hiveUrlStr = hiveApiUrlInput.value.trim() || DEFAULT_HIVE_API_URL;
			const magiIndexerStr = (magiIndexerInput.value.trim() || DEFAULT_MAGI_INDEXER_URL)
				// strip a trailing /v1/graphql (or /v1/graphql/) if the user pasted the full URL
				.replace(/\/+v1\/graphql\/?$/, '')
				.replace(/\/+$/, '');
			// Only validate a field's URL when "Custom" is checked (auto has
			// no user-entered URL to validate).
			const vscUrl = customVsc ? URL.parse(vscUrlStr) : null;
			if (customVsc && !vscUrl) {
				console.error('Unexpected: API URL invalid');
				return;
			}
			const hiveUrl = customHive ? URL.parse(hiveUrlStr) : null;
			if (customHive && !hiveUrl) {
				console.error('Unexpected: HIVE API URL invalid');
				return;
			}
			if (customIndexer && !URL.parse(magiIndexerStr)) {
				console.error('Unexpected: Magi Indexer URL invalid');
				return;
			}
			const allowBackups = hiveAllowBackupsCheckbox.checked;
			// VSC
			if (customVsc) {
				localStorage.setItem(keyVscGql, vscUrl!.origin);
				localStorage.setItem(MODE_KEY.vsc, 'manual');
			} else {
				localStorage.removeItem(keyVscGql);
				localStorage.setItem(MODE_KEY.vsc, 'auto');
			}
			// Magi Indexer
			if (customIndexer) {
				localStorage.setItem(keyMagiIndexer, magiIndexerStr);
				localStorage.setItem(MODE_KEY.indexer, 'manual');
			} else {
				localStorage.removeItem(keyMagiIndexer);
				localStorage.setItem(MODE_KEY.indexer, 'auto');
			}
			// Hive
			if (customHive) {
				localStorage.setItem(keyHiveApiList, hiveUrl!.origin);
				localStorage.setItem(MODE_KEY.hive, 'manual');
			} else {
				localStorage.removeItem(keyHiveApiList);
				localStorage.setItem(MODE_KEY.hive, 'auto');
			}
			localStorage.setItem(keyHiveApiAllowBackups, allowBackups.toString());
			// Advanced inputs are only mounted when advancedOptions is true.
			if (advancedOptions) {
				localStorage.setItem(
					keyVscNetworkId,
					vscNetworkIdInput.value.trim() || DEFAULT_VSC_NETWORK_ID
				);
				localStorage.setItem(keyHiveNetworkId, hiveNetworkIdInput.value.trim());
				localStorage.setItem(keyTests, testsInput.value.trim() || DEFAULT_HIVE_ASSET_NAME);
				localStorage.setItem(keyTbd, tbdInput.value.trim() || DEFAULT_HBD_ASSET_NAME);
			}

			await invalidateAll();
			location.reload();
		}}
	>
		<LabelHint
			forId="keyVscApi"
			text="API URL"
			hint="The Magi node every query goes to. Leave it on auto unless you are running your own."
		/>

		<label class="custom-toggle">
			<input type="checkbox" bind:checked={customVsc} /> Custom (override auto node selection)
		</label>
		<input
			id="keyVscApi"
			bind:this={vscGqlUrlInput}
			disabled={!customVsc}
			value={(browser && localStorage.getItem(keyVscGql)) || DEFAULT_GQL_URL}
			type="url"
		/>
		{#if customVsc}
			<PillButton
				styleType="outline"
				onclick={(e) => {
					localStorage.setItem(keyVscGql, DEFAULT_GQL_URL);
					vscGqlUrlInput.value = DEFAULT_GQL_URL;
				}}
				type="button">Reset</PillButton
			>
		{/if}
		{#if browser && !customVsc}
			<span class="auto-note">Auto-selected: {autoSelectedNodeUrl('vsc')}</span>
		{/if}
		<br />
		<br />
		<LabelHint
			forId="magi-indexer-url"
			text="Magi Indexer"
			hint="Where the history and pool figures come from — a Hasura endpoint over indexed Magi data. Defaults to the okinoko production indexer."
		/>
		<label class="custom-toggle">
			<input type="checkbox" bind:checked={customIndexer} /> Custom (override auto node selection)
		</label>
		<input
			id="magi-indexer-url"
			bind:this={magiIndexerInput}
			disabled={!customIndexer}
			value={(browser && localStorage.getItem(keyMagiIndexer)) || DEFAULT_MAGI_INDEXER_URL}
			type="url"
		/>
		{#if customIndexer}
			<PillButton
				styleType="outline"
				onclick={() => {
					localStorage.setItem(keyMagiIndexer, DEFAULT_MAGI_INDEXER_URL);
					magiIndexerInput.value = DEFAULT_MAGI_INDEXER_URL;
				}}
				type="button">Reset</PillButton
			>
		{/if}
		{#if browser && !customIndexer}
			<span class="auto-note">Auto-selected: {autoSelectedNodeUrl('indexer')}</span>
		{/if}
		<br />
		<br />
		<LabelHint
			forId="vsc-gql-url"
			text="Hive API URL"
			hint="The Hive node used for L1 reads and broadcasts. Leave it on auto unless you are running your own."
		/>

		<label class="custom-toggle">
			<input type="checkbox" bind:checked={customHive} /> Custom (override auto node selection)
		</label>
		<input
			id="vsc-gql-url"
			bind:this={hiveApiUrlInput}
			disabled={!customHive}
			value={(browser && localStorage.getItem(keyHiveApiList)) || DEFAULT_HIVE_API_URL}
			type="url"
		/>
		{#if customHive}
			<PillButton
				styleType="outline"
				onclick={(e) => {
					localStorage.setItem(keyHiveApiList, DEFAULT_HIVE_API_URL);
					hiveApiUrlInput.value = DEFAULT_HIVE_API_URL;
				}}
				type="button">Reset</PillButton
			>
		{/if}
		{#if browser && !customHive}
			<span class="auto-note">Auto-selected: {autoSelectedNodeUrl('hive')}</span>
		{/if}
		<div class="backup-box">
			<label for="hive-api-allow-backups">
				<input
					type="checkbox"
					id="hive-api-allow-backups"
					checked={localStorage.getItem(keyHiveApiAllowBackups) === 'true'}
					bind:this={hiveAllowBackupsCheckbox}
				/>
				Enable backup API fallback.
			</label>
		</div>

		<br />

		<PillButton
			styleType="text-subtle"
			onclick={(e) => {
				e.preventDefault();
				advancedOptions = !advancedOptions;
			}}
		>
			<span class="sm-caption"> {advancedOptions ? 'Hide' : 'Show'} Advanced Settings </span>
		</PillButton>

		{#if advancedOptions}
			<LabelHint
				forId="vsc-network-id"
				text="Magi Custom Network ID"
				hint="⚠ Posts your transactions to a different network. Leave this alone unless you know exactly what it does."
			/>
			<input
				id="vsc-network-id"
				bind:this={vscNetworkIdInput}
				value={(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NETWORK_ID}
				type="text"
			/>
			<br />
			<LabelHint
				forId="hive-network-id"
				text="Hive Custom Network ID"
				hint="⚠ Posts your transactions to a different network. Leave this alone unless you know exactly what it does."
			/>
			<input
				id="hive-network-id"
				bind:this={hiveNetworkIdInput}
				value={(browser && localStorage.getItem(keyHiveNetworkId)) || ''}
				type="text"
			/>
			<br />
			<LabelHint
				forId="prefs-tests"
				text="HIVE Asset Name"
				hint="⚠ Renames HIVE everywhere in the interface. For testnets that use a different ticker."
			/>
			<input
				id="prefs-tests"
				bind:this={testsInput}
				value={(browser && localStorage.getItem(keyTests)) || DEFAULT_HIVE_ASSET_NAME}
				type="text"
			/>
			<br />
			<LabelHint
				forId="prefs-tbd"
				text="HBD Asset Name"
				hint="⚠ Renames HBD everywhere in the interface. For testnets that use a different ticker."
			/>
			<input
				id="prefs-tbd"
				bind:this={tbdInput}
				value={(browser && localStorage.getItem(keyTbd)) || DEFAULT_HBD_ASSET_NAME}
				type="text"
			/>
		{/if}

		<br />
		<br />

		<PillButton
			styleType="invert"
			theme="primary"
			onclick={() => {
				// intentionally left blank
			}}>Save</PillButton
		>
	</form>

	<div class="theme">
		<span>Theme</span>
		<ToggleTheme />
	</div>
</div>

<style lang="scss">
	.sections {
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	/* The field labels are `ui/LabelHint`, which brings its own layout; this
	   only restores the colour and face the page sets for the rest of the form. */
	.sections :global(label.alt-label) {
		margin-bottom: 0;
		color: var(--alt-tx, var(--dash-text-primary));
		font-family: 'Nunito Sans', sans-serif;
		font-size: 1rem;
	}
	.theme {
		span {
			margin-left: 0.25rem;
			margin-bottom: 0.25rem;
			color: var(--dash-text-secondary);
		}
	}
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: #6f6af8;
		cursor: pointer;
	}
	.backup-box {
		display: flex;
		align-items: center;
	}
	.custom-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--dash-text-secondary);
		margin-bottom: 0.3rem;
	}
	input[type='url']:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.auto-note {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.7rem;
		color: var(--dash-text-secondary);
		opacity: 0.75;
		word-break: break-all;
	}
</style>
