import type { CustomJsonOperation } from '@hiveio/dhive';
import type { CallContractOp } from './vsc-op-types';

export function getCallContractOp(
	from: string,
	contractId: string,
	action: string,
	payload: Record<string, unknown>
): CustomJsonOperation {
	const jsonOutput: CallContractOp = {
		action,
		contract_id: contractId,
		payload: JSON.stringify(payload),
		rc_limit: 10000,
		intents: [],
		type: 'call'
	};

	return [
		'custom_json',
		{
			required_auths: [from],
			required_posting_auths: [],
			id: 'vsc.call',
			json: JSON.stringify(jsonOutput)
		}
	];
}
