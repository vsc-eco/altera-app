<script>
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { GQL_URL } from '../../../client';
	import ToggleTheme from './ToggleTheme.svelte';
	let vscGqlUrlInput = $state();
</script>

<h1>App Preferences</h1>
<div class="sections">
	<form
		onsubmit={async (e) => {
			const url = URL.parse(vscGqlUrlInput.value);
			e.preventDefault();
			if (!url) {
				console.error('Unexpected: form input should have been prevalidated bc type=url');
				return;
			}
			localStorage.setItem('vsc-gql-url', url.origin);
			await invalidateAll();
			location.reload();
		}}
	>
		<span class="label-tooltip">
			<label for="vsc-gql-url">API URL</label>
			<InfoTooltip>Edit this to direct queries to a custom VSC node.</InfoTooltip>
		</span>

		<input
			id="vsc-gql-url"
			bind:this={vscGqlUrlInput}
			value={(browser && localStorage.getItem('vsc-gql-url')) || 'https://api.vsc.eco'}
			type="url"
		/>
		<PillButton
			styleType="outline"
			onclick={(e) => {
				localStorage.setItem('vsc-gql-url', GQL_URL);
				vscGqlUrlInput.value = GQL_URL;
			}}
			type="button">Reset</PillButton
		>
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
		}
	}
	.theme {
		span {
			margin-left: 0.25rem;
			margin-bottom: 0.25rem;
			color: var(--primary-fg-mid);
		}
	}
</style>
