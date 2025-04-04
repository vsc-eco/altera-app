import { encode } from '@ipld/dag-cbor';
import { encodePayload } from 'dag-jose-utils';
import type { Signer } from '../client';
import { type Config, signTypedData } from '@wagmi/core';
import { convertCBORToEIP712TypedData } from './cbor_to_eip712_converter';

export const wagmiSigner = (async (txData, _, config: Config) => {
	const types = convertCBORToEIP712TypedData('vsc.network', encode(txData), 'tx_container_v0');
	const signature = await signTypedData(config, types as any);

	const sigs = [
		{
			t: 'eip191',
			//Key id copy
			s: signature
		} as const
	];

	const rawTx = (await encodePayload(txData)).linkedBlock;

	return {
		sigs,
		rawTx
	};
}) satisfies Signer<[Config]>;
