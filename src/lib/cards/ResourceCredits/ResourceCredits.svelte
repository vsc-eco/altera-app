<script lang="ts">
	import Card from '../Card.svelte';
	import Progress from '$lib/zag/Progress.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { DHive } from '$lib/vscTransactions/dhive';
	import type { Manabar } from '@hiveio/dhive/lib/chain/rc';
	import moment from 'moment';
	import { getDateFromBlockHeight } from '../../../routes/(authed)/transactions/getDateFromBlockHeight';
	import InfoToolip from '$lib/components/InfoToolip.svelte';
	let { username, isHive }: { username: string | undefined; isHive: boolean } = $props();

	let rc: Manabar | null = $state(null);

	$effect(() => {
		if (!username || !isHive) return;
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
	const HIVE_REGEN_TIME = 5 * 24 * 60;
	let hiveRegenTime = $derived.by(() => {
		if (!rc) return null;
		return moment.duration((1 - rc.percentage * 1e-4) * HIVE_REGEN_TIME, 'minutes');
	});
	let vscRegenTime = $derived.by(() => {
		if (!rc) return null;
		return moment.duration(
			moment.duration(5, 'days').asSeconds() -
				moment().diff(
					moment(getDateFromBlockHeight($accountBalance.bal.last_tx_height)),
					'seconds'
				),
			'seconds'
		);
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
		<div class="vsc-credits">
			<h5>VSC Resource Credits</h5>
			<div class="bar-and-info">
				<div class="bar-wrapper">
					<Progress
						boundaries={{ min: 0, max: $accountBalance.bal.hbd / 1000 }}
						currentValue={$accountBalance.loading
							? null
							: $accountBalance.bal.resource_credits / 1000}
						timerLabel={vscRegenTime &&
						vscRegenTime.asSeconds() > 0 &&
						$accountBalance.bal.resource_credits / $accountBalance.bal.hbd < 0.85
							? `Full in ${durationToString(vscRegenTime)}`
							: undefined}
					/>
				</div>
				<span class="info-button">
					<InfoToolip>
						VSC Resource Credits are non-transferable credits that let you perform blockchain
						actions. They regenerate over 5 days after use and are based on your deposited HBD. Hive
						account holders receive an extra 5.000 credits.
					</InfoToolip>
				</span>
			</div>
		</div>
		{#if isHive}
			<div class="hive-credits">
				<h5>Hive Resource Credits</h5>
				<div class="bar-and-info">
					<div class="bar-wrapper">
						<Progress
							boundaries={{ min: 0, max: rc?.max_mana ?? 0 }}
							currentValue={rc ? Math.min(rc.current_mana, rc.max_mana) : null}
							colorVar="--secondary-fg-mid"
							timerLabel={hiveRegenTime && hiveRegenTime.asSeconds() > 0
								? `Full in ${durationToString(hiveRegenTime)}`
								: undefined}
						/>
					</div>

					<span class="info-button">
						<InfoToolip>
							Hive Resource Credits are non-transferable credits that are used to perform all
							actions across the Hive blockchain. It takes 5 days to regenerate all of your resource
							credits.
						</InfoToolip>
					</span>
				</div>
			</div>
		{/if}
	</div>
</Card>

<style lang="scss">
	.rc-wrapper {
		margin: 0.75rem;
		margin-top: 0rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		vertical-align: middle;
		.bar-and-info {
			display: flex;
			gap: 0.5rem;
			.bar-wrapper {
				flex-grow: 1;
			}
			.info-button {
				padding-top: 1.6rem;
			}
		}
	}
</style>
