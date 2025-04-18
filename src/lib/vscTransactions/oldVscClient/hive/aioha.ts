import { Aioha, KeyTypes } from '@aioha/aioha';
import { type HiveSigner } from '../client';
import type { OperationName } from '@hiveio/dhive';

export const aiohaSigner = {
	async json(
		auth: 'active' | 'posting',
		id,
		tx,
		aioha: { customJSON: (arg0: KeyTypes, arg1: any, arg2: any) => any }
	) {
		const res = await aioha.customJSON(mapAuthToKeyType(auth), id, tx);
		if (!res.success) {
			throw new Error(res.error);
		}
		return {
			id: res.result
		};
	},
	async transfer(tx, aioha) {
		const res = await aioha.signAndBroadcastTx([['transfer', tx.payload]], KeyTypes.Active);
		if (res.success) {
			return { id: res.result };
		} else {
			throw new Error(`Transfer unsuccessful: ${tx}`);
		}
	}
} satisfies HiveSigner<[Aioha]>;

function mapAuthToKeyType(auth: 'active' | 'posting'): KeyTypes {
	return auth as KeyTypes;
}
