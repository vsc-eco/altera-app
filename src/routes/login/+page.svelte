<script lang="ts">
	// The landing page itself lives in $lib/landing so that BOTH public URLs
	// can render it: `/` (the URL search engines and visitors actually use)
	// and `/login` (where every in-app auth guard and older link points).
	// The component's canonical tag names `/`, so the two URLs consolidate
	// onto the root instead of competing as duplicates.
	import LandingPage from '$lib/landing/LandingPage.svelte';
</script>

<LandingPage />
