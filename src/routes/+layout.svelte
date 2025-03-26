<script>
	import '@styles/reset.css';
	import '@styles/colors.scss';
	import '@styles/base.scss';
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import AuthInjector from '$lib/auth/AuthInjector.svelte';
	import GraphQlInjector from '$lib/GraphQLInjector.svelte';
	let { children } = $props();
</script>

<AuthInjector>
	<GraphQlInjector>
		{@render children()}
	</GraphQlInjector>
</AuthInjector>
