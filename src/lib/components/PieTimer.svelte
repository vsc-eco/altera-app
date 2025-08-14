<script lang="ts">
	import { onDestroy } from 'svelte';

	let {
		size = 24,
		duration = 5000,
		onComplete
	}: {
		size?: number;
		duration?: number;
		onComplete: () => void;
	} = $props();

	let progress = $state(100);
	let animationId = $state(0);
	let isRunning = $state(false);
	const radius = 40;
	const circumference = 2 * Math.PI * radius;

	let strokeDashoffset = $derived(circumference - (progress / 100) * circumference);

	function start() {
		if (isRunning) return;
		isRunning = true;
		progress = 100;
		const startTime = Date.now();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, duration - elapsed);

			progress = (remaining / duration) * 100;

			if (remaining > 0 && isRunning) {
				animationId = requestAnimationFrame(animate);
			} else {
				progress = 0;
				isRunning = false;
				if (remaining <= 0) {
					onComplete();
				}
			}
		};

		animationId = requestAnimationFrame(animate);
	}

	function stop() {
		isRunning = false;
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
	}

	export { start, stop };

	onDestroy(() => {
		stop();
	});
</script>

<div
	class="pie-timer"
	style="
    --timer-size: {size}px; 
    width: var(--timer-size); 
    height: var(--timer-size);
  "
>
	<svg width={size} height={size} class="timer-svg" viewBox="0 0 100 100">
		<defs>
			<mask id="pie-mask">
				<rect width="100" height="100" fill="white" />
				<circle
					cx="50"
					cy="50"
					r="40"
					fill="none"
					stroke="black"
					stroke-width="80"
					stroke-dasharray={circumference}
					stroke-dashoffset={strokeDashoffset}
					transform="rotate(-90 50 50)"
					pathLength={circumference}
				/>
			</mask>
		</defs>

		<!-- Background circle (full) -->
		<circle cx="50" cy="50" r="50" fill="var(--neutral-bg-accent-shifted)" />

		<!-- Progress circle (filled pie using mask) -->
		<circle cx="50" cy="50" r="50" fill="var(--neutral-bg-accent)" mask="url(#pie-mask)" />
	</svg>
</div>

<style>
	.pie-timer {
		position: relative;
		display: inline-block;
		border-radius: 50%;
		overflow: hidden;
	}

	.timer-svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
