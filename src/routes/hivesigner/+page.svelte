<script>
	import { browser } from '$app/environment';
	import { hivesignerCb } from '@aioha/aioha/build/lib/hivesigner-cb';
	if (browser) hivesignerCb();
</script>
