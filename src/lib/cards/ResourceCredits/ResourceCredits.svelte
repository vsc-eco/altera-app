<script lang="ts">
	import Card from '../Card.svelte';
	import Progress from '$lib/zag/Progress.svelte';
	import { accountBalance } from '$lib/balances';
	import { DHive } from '$lib/vscTransactions/dhive';
	import type { Manabar } from '@hiveio/dhive/lib/chain/rc';
	import Popover from '$lib/zag/Popover.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { type HTMLButtonAttributes } from 'svelte/elements';
	import { Info } from '@lucide/svelte';
	import moment from 'moment';
	let { username, isHive }: { username: string | undefined; isHive: boolean } = $props();

	let rc: Manabar | null = $state(null);

	$effect(() => {
		if (!username) return;
		const fetchRC = async () => {
			try {
				rc = await DHive.rc.getRCMana(username);
			} catch (error) {
				console.error('Failed to fetch hive RC:', error);
			}
		};

		// run immediately and then on 5s interval
		fetchRC();
		const intervalId = setInterval(fetchRC, 5000);

		return () => {
			clearInterval(intervalId);
		};
	});
	// regen time in minutes
	const HIVE_RC_REGEN_TIME = 5 * 24 * 60;
	$effect(() => {
		console.log('percent', rc?.percentage);
	});
	let hiveRegenTime = $derived.by(() => {
		if (!rc) return null;
		return moment.duration((1 - rc.percentage * 1e-4) * HIVE_RC_REGEN_TIME, 'minutes');
	});
	function durationToString(d: moment.Duration) {
		let output = '';
		if (d.days() > 0) {
			output = output.concat(`${d.days()} ${d.days() === 1 ? 'Day' : 'Days'}, `);
		}
		if (d.asSeconds() > 0) {
			output = output.concat(`${d.hours()}:${d.minutes().toString().padStart(2, '0')}`);
		}
		return output;
	}
</script>

<Card>
	<div class="rc-wrapper">
		<h2>Resource Credits</h2>
		<div class="rc-display">
			<div class="vsc-credits">
				<h5>VSC Resource Credits</h5>
				<!-- TODO: remove the 5000 and make the math right -->
				<div class="bar-and-info">
					<Progress
						boundaries={{ min: 0, max: ($accountBalance.bal.hbd + 5000) / 1000 }}
						currentValue={$accountBalance.loading
							? null
							: ($accountBalance.bal.resource_credits + 5000) / 1000}
					/>
					{#snippet trigger(attributes: HTMLButtonAttributes)}
						<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon-subtle">
							<Info />
						</PillButton>
					{/snippet}
					<span class="info-button">
						<Popover {trigger}>
							<p>
								VSC Resource Credits are non-transferable credits that let you perform blockchain
								actions. They regenerate over 5 days after use and are based on your deposited HBD.
								Hive account holders receive an extra 5.000 credits.
							</p>
						</Popover></span
					>
				</div>
			</div>
			{#if isHive}
				<div class="hive-credits">
					<h5>Hive Resource Credits</h5>
					<div class="bar-and-info">
						<div class="hive-bar-wrapper">
							<Progress
								boundaries={{ min: 0, max: rc?.max_mana ?? 0 }}
								currentValue={rc?.current_mana ?? null}
								colorVar="--secondary-fg-mid"
							/>
							{#if hiveRegenTime}
								<div class="regeneration">Full in {durationToString(hiveRegenTime)}</div>
							{/if}
						</div>
						{#snippet trigger(attributes: HTMLButtonAttributes)}
							<PillButton {...attributes} onclick={attributes.onclick!} styleType="icon-subtle">
								<Info />
							</PillButton>
						{/snippet}
						<span class="info-button">
							<Popover {trigger}>
								<p>
									Hive Resource Credits are non-transferable credits that are used to perform all
									actions across the Hive blockchain. It takes 5 days to regenerate all of your
									resource credits.
								</p>
							</Popover></span
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<!-- {#if rc}
        Current: {rc.current_mana}
        Max: {rc.max_mana}
        %: {rc.percentage}
    {/if} -->
</Card>

<style lang="scss">
	.rc-wrapper {
		margin: 1rem;
	}
	.rc-display {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		vertical-align: middle;
		.bar-and-info {
			display: flex;
			gap: 0.5rem;
			&:first-child {
				flex-grow: 1;
			}
			.hive-bar-wrapper {
				flex-grow: 1;
			}
			.info-button {
				padding-top: 1.6rem;
			}
		}
	}

	.regeneration {
		text-align: right;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		padding-top: 0.25rem;
	}
</style>
