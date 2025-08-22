<script lang="ts">
	import PillButton from '$lib/PillButton.svelte';
	import { X } from '@lucide/svelte';
	import { root } from 'viem/chains';
	let {
		close
	}: {
		close: () => void;
	} = $props();
</script>

<header id="send-header">
	<a class="logo-slogan" href="/" tabindex="-1">
		<img src="altera_med.png" alt="VSC" />
		<span class="vertical-line"></span>
		Altera - The Future of Trustless Finance
	</a>

	<PillButton onclick={close} styleType="icon-subtle">
		<!-- <X className="close-button"/> -->
		<span class="close-button"><X size={36} /></span>
	</PillButton>
</header>

<style lang="scss">
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 3rem;
	}
	a {
		text-decoration: none;
		color: var(--fg);
	}
	.logo-slogan {
		display: flex;
		align-items: center;
		gap: 1rem;
		.vertical-line {
			height: 2.5rem;
			width: 1px;
			position: relative;
			background-color: var(--neutral-bg-mid);
		}
		img {
			width: 2.5rem;
			filter: invert(var(--is-dark-mode));
		}
	}
	// point where it's as wide as content
	@media screen and (max-width: 776px) {
		header {
			margin-left: 1rem;
			margin-right: 1rem;
		}
	}
	@media screen and (max-height: 700px) {
		header {
			margin-top: 1rem;
			margin-bottom: 1rem;
		}
	}
</style>
