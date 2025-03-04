<script>
	import AppKitLogin from '$lib/auth/AppKitLogin.svelte';
	import HiveLogin from '$lib/auth/HiveLogin.svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth/store';
	import { browser } from '$app/environment';

	$effect(() => {
		let unsub = authStore.subscribe((v) => {
			if (v.status == 'authenticated' && browser) {
				const to = localStorage.getItem('redirect_url') ?? '/';
				localStorage.removeItem('redirect_url');
				goto(to);
			}
		});
		return unsub;
	});
</script>

<AppKitLogin />
<HiveLogin />
