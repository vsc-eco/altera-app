<script>
	import LineChart from '$lib/LineChart.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { Send, HandCoins, PiggyBank } from 'lucide-svelte';
</script>

<h1>Welcome, Name</h1>
<PillBtn theme="primary" href="./send"><Send /> Send</PillBtn>
<PillBtn href="./receive"><HandCoins /> Receive</PillBtn>
<PillBtn href="./deposit"><PiggyBank /> Deposit</PillBtn>
<LineChart></LineChart>
