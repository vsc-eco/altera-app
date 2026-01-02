import { writable, get } from 'svelte/store';

export const mappingActionStore = writable<Record<string, string | undefined>>({});

export function getOpAction(newOp: any): string {
	try {
		let payload = newOp.data;
		if (typeof payload.json === 'string') {
			payload = JSON.parse(payload.json);
		}
		return payload.action ?? '';
	} catch (e) {
		return '';
	}
}

export async function fetchActionForOpKey(txId: string, opIndex: number): Promise<string> {
	const key = `${txId}:${opIndex}`;
	const current = get(mappingActionStore);
	if (current[key] !== undefined) return current[key] || '';
	try {
		const res = await fetch(`https://techcoderx.com/hafah-api/transactions/${txId}?include-virtual=true`);
		if (!res.ok) {
			mappingActionStore.update((s) => ({ ...s, [key]: '' }));
			return '';
		}
		const data = await res.json();
		const opJson = data.transaction_json?.operations?.[opIndex]?.value?.json;
		if (opJson) {
			const parsed = JSON.parse(opJson);
			const action = parsed.action ?? '';
			mappingActionStore.update((s) => ({ ...s, [key]: action }));
			return action;
		}
	} catch (e) {
		console.error('fetchActionForOpKey failed', e);
	}
	mappingActionStore.update((s) => ({ ...s, [key]: '' }));
	return '';
}
