<script>
	import Balance from '$lib/cards/Balance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
	import { Send, HandCoins, PiggyBank } from 'lucide-svelte';
</script>

<h1>Welcome, Name</h1>
<PillBtn theme="primary" style="invert" href="./send"><Send /> Send</PillBtn>
<PillBtn href="./receive"><HandCoins /> Receive</PillBtn>
<PillBtn href="./deposit"><PiggyBank /> Deposit</PillBtn>
<Balance></Balance>
