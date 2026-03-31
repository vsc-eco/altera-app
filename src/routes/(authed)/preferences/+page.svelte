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
	import { DEFAULT_GQL_URL, keyVscGql, keyVscNetworkId, keyTests, keyTbd } from '../../../client';
	import ToggleTheme from './ToggleTheme.svelte';

	const DEFAULT_HIVE_API_URL = 'https://api.hive.blog';
	const DEFAULT_VSC_NETWORK_ID = 'vsc-mainnet';
	const DEFAULT_HIVE_ASSET_NAME = 'HIVE';
	const DEFAULT_HBD_ASSET_NAME = 'HBD';

	let vscGqlUrlInput: HTMLInputElement = $state()!;
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
			const vscUrl = URL.parse(vscUrlStr);
			if (!vscUrl) {
				console.error('Unexpected: API URL invalid');
				return;
			}
			const hiveUrl = URL.parse(hiveUrlStr);
			if (!hiveUrl) {
				console.error('Unexpected: HIVE API URL invalid');
				return;
			}
			const allowBackups = hiveAllowBackupsCheckbox.checked;
			localStorage.setItem(keyVscGql, vscUrl.origin);
			localStorage.setItem(keyHiveApiList, hiveUrl.origin);
			localStorage.setItem(keyHiveApiAllowBackups, allowBackups.toString());
			localStorage.setItem(
				keyVscNetworkId,
				vscNetworkIdInput.value.trim() || DEFAULT_VSC_NETWORK_ID
			);
			localStorage.setItem(keyHiveNetworkId, hiveNetworkIdInput.value.trim());
			localStorage.setItem(
				keyTests,
				testsInput.value.trim() || DEFAULT_HIVE_ASSET_NAME
			);
			localStorage.setItem(keyTbd, tbdInput.value.trim() || DEFAULT_HBD_ASSET_NAME);

			await invalidateAll();
			location.reload();
		}}
	>
		<span class="label-tooltip">
			<label for="keyVscApi">API URL</label>
			<InfoTooltip>Edit this to direct queries to a custom VSC node.</InfoTooltip>
		</span>

		<input
			id="keyVscApi"
			bind:this={vscGqlUrlInput}
			value={(browser && localStorage.getItem(keyVscGql)) || 'https://api.vsc.eco'}
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
			<label for="vsc-gql-url">HIVE API URL</label>
			<InfoTooltip>Edit this to direct queries to a custom HIVE node.</InfoTooltip>
		</span>

		<input
			id="vsc-gql-url"
			bind:this={hiveApiUrlInput}
			value={(browser && localStorage.getItem(keyHiveApiList)) || DEFAULT_HIVE_API_URL}
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
				<label for="vsc-network-id">VSC Custom Network ID</label>
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
				<label for="hive-network-id">HIVE Custom Network ID</label>
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
				<label for="prefs-tests">Hive Asset Name</label>
				<InfoTooltip warning>
					Change the asset name for Hive.
				</InfoTooltip>
			</span>
			<input
				id="prefs-tests"
				bind:this={testsInput}
				value={(browser && localStorage.getItem(keyTests)) || DEFAULT_HIVE_ASSET_NAME}
				type="text"
			/>
			<br />
			<span class="label-tooltip">
				<label for="prefs-tbd">
					HBD Asset Name</label>
				<InfoTooltip warning>
					Change the asset name for HBD.
				</InfoTooltip>
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
		accent-color: #6F6AF8;
		cursor: pointer;
	}
	.backup-box {
		display: flex;
		align-items: center;
	}
</style>
