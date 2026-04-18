import { writable } from 'svelte/store';
import type { PoolRow } from '$lib/pools/poolsData';

export type RemoveLiquidityDraft = {
	selectedPool: PoolRow | null;
	lpAmount: number;
	hasError: boolean;
};

export const removeLiquidityDraftStore = writable<RemoveLiquidityDraft>({
	selectedPool: null,
	lpAmount: 0,
	hasError: false
});

export function resetRemoveLiquidityDraft() {
	removeLiquidityDraftStore.set({
		selectedPool: null,
		lpAmount: 0,
		hasError: false
	});
}
