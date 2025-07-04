<script lang="ts">
    import { getAuth } from '$lib/auth/store';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '../currency/Amount.svelte';
    import Tabs from '$lib/zag/Tabs.svelte';
    import Recipient from './sendStages/Recipient.svelte';

    const tabItems = [
        {value: 'recipient', label: 'Recipient', content: recipient}
    ]

    function initSwap(e: Event) {
        return;
    }
</script>

{#snippet recipient()}
    <Recipient />
{/snippet}

<form
	class={{ complete: false }}
	onsubmit={(e) => {
		initSwap(e);
	}}
	id="send"
>
    <Tabs items={tabItems}/>
</form>

<style lang='scss'>
    form {
        margin: auto;
        margin-top: 3rem;
    }
</style>
