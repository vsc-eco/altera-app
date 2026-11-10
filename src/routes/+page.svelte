<script lang="ts">
	// Public home page: the server-rendered landing page.
	//
	// Until 2026-11-10 `/` was the logged-in dashboard with `ssr = false`, so
	// the domain root — the URL everything links to — answered crawlers with a
	// 2.4 KB empty shell that then JS-redirected to /login. Google reported it
	// as "page with redirect" and picked its own canonical for /login. The
	// dashboard now lives at /dashboard and the root serves real content.
	//
	// Visitors who are already connected are sent on to /dashboard (or their
	// stored redirect target) by the landing component's auth effect.
	import LandingPage from '$lib/landing/LandingPage.svelte';
</script>

<LandingPage />
