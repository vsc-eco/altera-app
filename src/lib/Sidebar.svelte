<script>
	import { ScrollText } from '@lucide/svelte';
	import { ArrowRightLeft, Home } from 'lucide-svelte';
</script>

<nav>
	<a href="/"><Home /> Home</a>
	<a href="/transactions"><ScrollText /> Transactions</a>
	<a href="/swap"><ArrowRightLeft /> Swap</a>
</nav>

<style>
	nav {
		display: flex;
		flex-direction: column;
		background-color: var(--neutral-off-bg);
		border-right: 1px solid var(--neutral-bg-accent);
		min-height: 100%;
		padding: 0.5rem;
	}
	a {
		display: flex;
		height: 32px;
		align-items: center;
		margin: 0.25rem;
		padding: 0.25rem;
		box-sizing: border-box;
		border-radius: 0.25rem;
		color: var(--neutral-fg);
		text-decoration: none;
	}
	a:hover {
		background-color: var(--neutral-bg-accent);
	}
	a :global(.lucide-icon) {
		margin-right: 0.5rem;
	}
</style>
