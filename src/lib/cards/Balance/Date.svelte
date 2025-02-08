<script lang="ts">
	type Props = {
        dateRanges: []
		currDate?: Date;
	};
	let { date }: Props = $props();
</script>

<div class="date">{moment(date).format('MMMM D, YYYY')}</div>
