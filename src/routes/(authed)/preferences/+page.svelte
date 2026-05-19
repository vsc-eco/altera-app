<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
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
		resolveNodeUrl,
		isManualMode,
		MODE_KEY,
		type Category
	} from '$lib/nodeSelection/select';

	function initAuto(cat: Category): boolean {
		if (!browser) return true;
		// isManualMode also covers legacy users (custom key set, no mode key).
		return !isManualMode(cat);
	}
	let autoVsc = $state(initAuto('vsc'));
	let autoIndexer = $state(initAuto('indexer'));
	let autoHive = $state(initAuto('hive'));

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
			// Only validate a field's URL when it's in manual mode (auto
			// has no user-entered URL to validate).
			const vscUrl = autoVsc ? null : URL.parse(vscUrlStr);
			if (!autoVsc && !vscUrl) {
				console.error('Unexpected: API URL invalid');
				return;
			}
			const hiveUrl = autoHive ? null : URL.parse(hiveUrlStr);
			if (!autoHive && !hiveUrl) {
				console.error('Unexpected: HIVE API URL invalid');
				return;
			}
			if (!autoIndexer && !URL.parse(magiIndexerStr)) {
				console.error('Unexpected: Magi Indexer URL invalid');
				return;
			}
			const allowBackups = hiveAllowBackupsCheckbox.checked;
			// VSC
			if (autoVsc) {
				localStorage.removeItem(keyVscGql);
				localStorage.setItem(MODE_KEY.vsc, 'auto');
			} else {
				localStorage.setItem(keyVscGql, vscUrl!.origin);
				localStorage.setItem(MODE_KEY.vsc, 'manual');
			}
			// Magi Indexer
			if (autoIndexer) {
				localStorage.removeItem(keyMagiIndexer);
				localStorage.setItem(MODE_KEY.indexer, 'auto');
			} else {
				localStorage.setItem(keyMagiIndexer, magiIndexerStr);
				localStorage.setItem(MODE_KEY.indexer, 'manual');
			}
			// Hive
			if (autoHive) {
				localStorage.removeItem(keyHiveApiList);
				localStorage.setItem(MODE_KEY.hive, 'auto');
			} else {
				localStorage.setItem(keyHiveApiList, hiveUrl!.origin);
				localStorage.setItem(MODE_KEY.hive, 'manual');
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
		<span class="label-tooltip">
			<label for="keyVscApi">API URL</label>
			<InfoTooltip>Edit this to direct queries to a custom Magi node.</InfoTooltip>
		</span>

		<label class="auto-toggle">
			<input type="checkbox" bind:checked={autoVsc} /> Automatic node selection
		</label>
		<input
			id="keyVscApi"
			bind:this={vscGqlUrlInput}
			readonly={autoVsc}
			value={autoVsc
				? resolveNodeUrl('vsc')
				: (browser && localStorage.getItem(keyVscGql)) || 'https://api.vsc.eco'}
			type="url"
		/>
		<PillButton
			styleType="outline"
			onclick={(e) => {
				localStorage.setItem(keyVscGql, DEFAULT_GQL_URL);
				vscGqlUrlInput.value = DEFAULT_GQL_URL;
			}}
			type="button">Reset</PillButton
		>
		<br />
		<br />
		<span class="label-tooltip">
			<label for="magi-indexer-url">Magi Indexer</label>
			<InfoTooltip>
				Hasura GraphQL endpoint used to query indexed Magi data. Defaults to the okinoko/prod
				indexer.
			</InfoTooltip>
		</span>
		<label class="auto-toggle">
			<input type="checkbox" bind:checked={autoIndexer} /> Automatic node selection
		</label>
		<input
			id="magi-indexer-url"
			bind:this={magiIndexerInput}
			readonly={autoIndexer}
			value={autoIndexer
				? resolveNodeUrl('indexer')
				: (browser && localStorage.getItem(keyMagiIndexer)) || DEFAULT_MAGI_INDEXER_URL}
			type="url"
		/>
		<PillButton
			styleType="outline"
			onclick={() => {
				localStorage.setItem(keyMagiIndexer, DEFAULT_MAGI_INDEXER_URL);
				magiIndexerInput.value = DEFAULT_MAGI_INDEXER_URL;
			}}
			type="button">Reset</PillButton
		>
		<br />
		<br />
		<span class="label-tooltip">
			<label for="vsc-gql-url">Hive API URL</label>
			<InfoTooltip>Edit this to direct queries to a custom Hive node.</InfoTooltip>
		</span>

		<label class="auto-toggle">
			<input type="checkbox" bind:checked={autoHive} /> Automatic node selection
		</label>
		<input
			id="vsc-gql-url"
			bind:this={hiveApiUrlInput}
			readonly={autoHive}
			value={autoHive
				? resolveNodeUrl('hive')
				: (browser && localStorage.getItem(keyHiveApiList)) || DEFAULT_HIVE_API_URL}
			type="url"
		/>
		<PillButton
			styleType="outline"
			onclick={(e) => {
				localStorage.setItem(keyHiveApiList, DEFAULT_HIVE_API_URL);
				hiveApiUrlInput.value = DEFAULT_HIVE_API_URL;
			}}
			type="button">Reset</PillButton
		>
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
			<span class="label-tooltip">
				<label for="vsc-network-id">Magi Custom Network ID</label>
				<InfoTooltip warning>
					Enables posting transactions to an alternate network. Not recommended unless you
					understand the implications.
				</InfoTooltip>
			</span>
			<input
				id="vsc-network-id"
				bind:this={vscNetworkIdInput}
				value={(browser && localStorage.getItem(keyVscNetworkId)) || DEFAULT_VSC_NETWORK_ID}
				type="text"
			/>
			<br />
			<span class="label-tooltip">
				<label for="hive-network-id">Hive Custom Network ID</label>
				<InfoTooltip warning>
					Enables posting transactions to an alternate network. Not recommended unless you
					understand the implications.
				</InfoTooltip>
			</span>
			<input
				id="hive-network-id"
				bind:this={hiveNetworkIdInput}
				value={(browser && localStorage.getItem(keyHiveNetworkId)) || ''}
				type="text"
			/>
			<br />
			<span class="label-tooltip">
				<label for="prefs-tests">HIVE Asset Name</label>
				<InfoTooltip warning>Change the asset name for HIVE.</InfoTooltip>
			</span>
			<input
				id="prefs-tests"
				bind:this={testsInput}
				value={(browser && localStorage.getItem(keyTests)) || DEFAULT_HIVE_ASSET_NAME}
				type="text"
			/>
			<br />
			<span class="label-tooltip">
				<label for="prefs-tbd"> HBD Asset Name</label>
				<InfoTooltip warning>Change the asset name for HBD.</InfoTooltip>
			</span>
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
	.label-tooltip {
		display: flex;
		align-items: center;
		label {
			margin-bottom: 0;
			color: var(--dash-text-primary);
			font-family: 'Nunito Sans', sans-serif;
		}
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
	.auto-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--dash-text-secondary);
		margin-bottom: 0.3rem;
	}
</style>
