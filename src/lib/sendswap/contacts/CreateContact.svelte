<script lang="ts">
	import { CircleUser, Plus, Trash2, X } from '@lucide/svelte';
	import { momentToLastPaidString, validateAddress } from '../utils/sendUtils';
	import { addContact, getAllLastPaid, removeContact, setContact, type Contact } from './contacts';
	import PillButton from '$lib/PillButton.svelte';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import { DHive } from '$lib/magiTransactions/dhive';
	import { untrack } from 'svelte';
	import { getProfilePicUrl } from '$lib/auth/hive/getProfilePicUrl';
	import { getDidFromUsername } from '$lib/getAccountName';
	import Editable from '$lib/zag/Editable.svelte';
	import Divider from '$lib/components/Divider.svelte';
	import Confirmation from '$lib/components/Confirmation.svelte';

	let { initial, close }: { initial?: Contact; close: () => void } = $props();

	const originalLabel = initial?.label;

	let contact: Contact = $state(
		initial ?? {
			label: '',
			addresses: [{ label: 'Primary Address', address: '' }],
			image: ''
		}
	);
	let suggestedImg = $state('');
	let userInputImg = $state('');
	let isSubmitting = $state(false);
	let submitSuccess = $state.raw(false);
	$effect(() => {
		const newUsername = contact.addresses[0].address;
		getProfilePicUrl(getDidFromUsername(newUsername)).then((url) => {
			if (url) {
				suggestedImg = url;
			} else {
				suggestedImg = '';
			}
		});
	});
	$effect(() => {
		const currentImg = userInputImg || suggestedImg;
		untrack(() => {
			if (contact.image !== currentImg) {
				contact.image = currentImg;
			}
		});
	});

	interface FormErrors {
		name?: string;
		addresses?: string[];
		image?: string;
	}
	let errors: FormErrors = $state({});

	function addAddressField() {
		contact.addresses.push({ address: '', label: 'Additional Address' });
	}

	function removeAddressField(index: number) {
		if (contact.addresses.length > 1) {
			contact.addresses = contact.addresses.filter((_, i) => i !== index);
			if (errors.addresses) {
				errors.addresses = errors.addresses.filter((_, i) => i !== index);
			}
		}
	}

	function validateName() {
		if (!contact.label.trim()) {
			errors.name = 'Please enter a name';
		}
	}
	// $inspect(errors.addresses[0]);
	async function validateAddressField(index: number) {
		const address = contact.addresses[index].address;

		if (!errors.addresses) {
			errors.addresses = [];
		}

		if (index === 0 && !address.trim()) {
			errors.addresses[index] = 'Please provide at least one address';
		} else if (address.trim()) {
			const result = await validateAddress(address);
			if (!result.success) {
				errors.addresses[index] = result.error ?? 'Invalid address';
			} else {
				delete errors.addresses[index];
			}
		} else {
			delete errors.addresses[index];
		}
	}

	async function getSuggestedHiveAccounts(
		value: string
	): Promise<{ label: string; value: string }[]> {
		if (value === '') return [];
		const result = await DHive.database.call('get_account_reputations', [
			value.toLocaleLowerCase(),
			3
		]);

		return result.map((item: any) => {
			if (item.account)
				return {
					label: item.account,
					value: item.account
				};
		});
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		validateName();

		await Promise.all(contact.addresses.map((_, index) => validateAddressField(index)));

		const lastPaid = await getAllLastPaid(contact);
		contact.lastPaid = momentToLastPaidString(lastPaid);

		// Check if there are any errors
		const hasNameError = errors.name !== undefined;
		const hasEmailErrors =
			errors.addresses && errors.addresses.some((error) => error !== undefined);

		if (hasNameError || hasEmailErrors) {
			return;
		}

		isSubmitting = true;
		submitSuccess = false;

		try {
			const contactToSave: Contact = {
				...contact,
				addresses: contact.addresses.filter((addr) => addr.address.trim())
			};

			if (initial) {
				setContact(contactToSave);
				if (originalLabel && originalLabel !== contactToSave.label) {
					removeContact(originalLabel);
				}
			} else {
				addContact(contactToSave);
			}

			contact = {
				label: '',
				addresses: [{ address: '', label: '' }]
			};
			errors = {};

			submitSuccess = true;
			setTimeout(() => (submitSuccess = false), 3000);
		} catch (error) {
			console.error('Failed to save contact:', error);
		} finally {
			isSubmitting = false;
			close();
		}
	}
	let toggleDeleteWarning = $state<(open?: boolean) => void>(() => {});
</script>

{#snippet label(addresses: Contact['addresses'], index: number)}
	<div class="label-wrapper">
		<Editable
			bind:value={addresses[index].label}
			alwaysShow={index === 0 ? ' *' : undefined}
			maxLength={20}
		/>
		{#if errors.addresses && errors.addresses[index]}
			<span class={['error', { primary: index === 0 }]}>{errors.addresses[index]}</span>
		{/if}
	</div>
{/snippet}

<h5>{`${initial ? 'Edit' : 'Create New'} Contact`}</h5>
<form>
	<div class="form-group">
		<div class="label-error">
			<label for="name">Name *</label>
			{#if errors.name}
				<span class="error">{errors.name}</span>
			{/if}
		</div>
		<input
			id="name"
			type="text"
			bind:value={contact.label}
			onblur={() => validateName()}
			oninput={() => delete errors.name}
			class:error={errors.name}
			disabled={isSubmitting}
			autocomplete="off"
		/>
	</div>
	<Divider text="Addresses" style="margin-top: 1.5rem;" />
	<ul class="form-group addresses">
		{#each contact.addresses as address, index (address.address + index)}
			<li class="address-group">
				<div class="address-row">
					{#snippet wrapAddressLabel()}
						{@render label(contact.addresses, index)}
					{/snippet}
					<ComboBox
						bind:value={contact.addresses[index].address}
						items={[]}
						getSuggestions={getSuggestedHiveAccounts}
						custom
						onBlur={() => validateAddressField(index)}
						label={wrapAddressLabel}
						placeholder={'Find Hive account or input wallet address'}
					/>
					{#if contact.addresses.length > 1}
						<span>
							<PillButton
								onclick={() => removeAddressField(index)}
								disabled={isSubmitting}
								aria-label="Remove address field"
								styleType="icon-subtle"
							>
								<Trash2 />
							</PillButton>
						</span>
					{/if}
				</div>
			</li>
		{/each}

		<div class="add-address-button">
			<PillButton onclick={addAddressField} disabled={isSubmitting}>
				<Plus /> Add Another Address
			</PillButton>
		</div>
	</ul>
	<!-- <div class="form-group image-group">
		{#if contact.image}
			<img src={contact.image} alt="Contact" />
		{:else}
			<CircleUser size="56" strokeWidth="4" absoluteStrokeWidth={true} />
		{/if}
		<div class="image-select">
			<div class="label-error">
				<label for="name">Image URL</label>
				{#if errors.image}
					<span class="error">{errors.image}</span>
				{/if}
			</div>
			<BasicCopy value={contact.image ?? userInputImg}>
				<input
					id="name"
					type="text"
					bind:value={userInputImg}
					onblur={() => validateName()}
					oninput={() => delete errors.image}
					class:error={errors.image}
					disabled={isSubmitting}
					autocomplete="off"
					placeholder={suggestedImg || undefined}
				/>
			</BasicCopy>
		</div>
	</div> -->
	<div class="buttons">
		{#if initial}
			<PillButton
				class=".ignore-dialog-close"
				onclick={(e) => {
					e.stopImmediatePropagation();
					e.preventDefault();
					e.stopPropagation();
					toggleDeleteWarning(true);
				}}
				theme="secondary"
				disabled={isSubmitting}
			>
				<Trash2 /> Delete
			</PillButton>
		{/if}
		<PillButton onclick={handleSubmit} styleType="invert" theme="accent" disabled={isSubmitting}>
			Save
		</PillButton>
	</div>
</form>
<Confirmation
	confirm={() => {
		removeContact(contact.label);
		close();
	}}
	bind:toggle={toggleDeleteWarning}
	customConfirm={{ icon: Trash2, text: 'Delete', color: 'secondary' }}
>
	<p>
		Are you sure you want to delete {contact.label || 'this contact'}?
	</p>
</Confirmation>

<style lang="scss">
	form {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.5rem;
		flex-grow: 1;
	}
	// .form-group.image-group {
	// 	margin-top: 1rem;
	// 	display: flex;
	// 	gap: 0.5rem;
	// 	img,
	// 	:global(.lucide-circle-user) {
	// 		margin-top: auto;
	// 		width: 3.5rem;
	// 	}
	// 	img {
	// 		border-radius: 100%;
	// 	}
	// 	.image-select {
	// 		flex-grow: 1;
	// 	}
	// }
	input {
		width: 100%;
		box-sizing: border-box;
	}
	.address-row {
		display: flex;
		gap: 0.5rem;
		span {
			margin-top: auto;
			height: 2.5rem;
			display: flex;
			align-items: center;
			:global(.lucide-trash-2) {
				color: var(--secondary-mid);
			}
		}
	}
	.label-error {
		label {
			margin-right: 0.5rem;
			white-space: nowrap;
		}
		display: flex;
	}
	ul {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}
	.buttons {
		display: inline-flex;
		margin-top: auto;
		margin-left: auto;
	}
	.label-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
		.error {
			height: min-content;
		}
	}
</style>
