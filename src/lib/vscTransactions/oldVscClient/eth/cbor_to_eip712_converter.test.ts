import { describe, it, expect } from 'vitest';
import { convertCBORToEIP712TypedData } from './cbor_to_eip712_converter';
import { encodePayload } from 'dag-jose-utils';

import { hashDomain, hashTypedData } from 'viem';

const intents: unknown[] = [];

describe('eth msg', () => {
	it('domain hash', () => {
		expect(
			hashDomain({
				domain: {
					name: 'vsc.network'
				},
				types: {
					EIP712Domain: [
						{
							name: 'name',
							type: 'string'
						}
					]
				}
			})
		).toBe('0xb364cbb4ec1c3d3d438ef95f01322f22b04280d481abaa8cd6c7b5c7108f1a7e');
	});

	it('matches conversion', async () => {
		const res = (
			await encodePayload({
				__t: 'vsc-tx',
				__v: '0.2',
				headers: {
					net_id: 'vsc-mainnet',
					nonce: 0 as any,
					rc_limit: 0 as any,
					required_auths: ['did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e']
				},
				tx: [
					{
						payload:
							'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
						type: 'transfer'
					},
					{
						payload:
							'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
						type: 'transfer'
					}
				]
			})
		).linkedBlock;
		expect(convertCBORToEIP712TypedData('vsc.network', res, 'tx_container_v0')).toStrictEqual({
			EIP712Domain: [
				{
					name: 'name',
					type: 'string'
				}
			],
			domain: {
				name: 'vsc.network'
			},
			primaryType: 'tx_container_v0',
			message: {
				__t: 'vsc-tx',
				__v: '0.2',
				headers: {
					net_id: 'vsc-mainnet',
					nonce: 0 as any,
					rc_limit: 0 as any,
					required_auths: ['did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e']
				},
				tx: {
					_0_: {
						payload:
							'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
						type: 'transfer'
					},
					_1_: {
						payload:
							'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
						type: 'transfer'
					}
				}
			},
			types: {
				tx_container_v0: [
					{
						name: 'tx',
						type: 'tx_container_v0_tx'
					},
					{
						name: '__t',
						type: 'string'
					},
					{
						name: '__v',
						type: 'string'
					},
					{
						name: 'headers',
						type: 'tx_container_v0_headers'
					}
				],
				tx_container_v0_headers: [
					{
						name: 'nonce',
						type: 'uint256'
					},
					{
						name: 'net_id',
						type: 'string'
					},
					{
						name: 'rc_limit',
						type: 'uint256'
					},
					{
						name: 'required_auths',
						type: 'string[]'
					}
				],
				tx_container_v0_tx: [
					{
						name: '_0_',
						type: 'tx_container_v0_tx__0_'
					},
					{
						name: '_1_',
						type: 'tx_container_v0_tx__1_'
					}
				],
				tx_container_v0_tx__0_: [
					{
						name: 'type',
						type: 'string'
					},
					{
						name: 'payload',
						type: 'string'
					}
				],
				tx_container_v0_tx__1_: [
					{
						name: 'type',
						type: 'string'
					},
					{
						name: 'payload',
						type: 'string'
					}
				]
			}
		});
	});

	it('full hash', () => {
		expect(
			hashTypedData({
				types: {
					tx_container_v0: [
						{
							name: 'tx',
							type: 'tx_container_v0_tx'
						},
						{
							name: '__t',
							type: 'string'
						},
						{
							name: '__v',
							type: 'string'
						},
						{
							name: 'headers',
							type: 'tx_container_v0_headers'
						}
					],
					tx_container_v0_headers: [
						{
							name: 'nonce',
							type: 'uint256'
						},
						{
							name: 'net_id',
							type: 'string'
						},
						{
							name: 'rc_limit',
							type: 'uint256'
						},
						{
							name: 'required_auths',
							type: 'string[]'
						}
					],
					tx_container_v0_tx: [
						{
							name: '_0_',
							type: 'tx_container_v0_tx__0_'
						},
						{
							name: '_1_',
							type: 'tx_container_v0_tx__1_'
						}
					],
					tx_container_v0_tx__0_: [
						{
							name: 'type',
							type: 'string'
						},
						{
							name: 'payload',
							type: 'string'
						}
					],
					tx_container_v0_tx__1_: [
						{
							name: 'type',
							type: 'string'
						},
						{
							name: 'payload',
							type: 'string'
						}
					]
				},
				primaryType: 'tx_container_v0',
				domain: {
					name: 'vsc.network'
				},
				message: {
					__t: 'vsc-tx',
					__v: '0.2',
					headers: {
						net_id: 'vsc-mainnet',
						nonce: 0 as any,
						rc_limit: 0 as any,
						required_auths: ['did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e']
					},
					tx: {
						_0_: {
							payload:
								'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
							type: 'transfer'
						},
						_1_: {
							payload:
								'{"amount":"0.001","asset":"hbd","from":"did:pkh:eip155:1:0x31160b3fF46E7406D7B28af9128b0407e05C376e","to":"hive:vsc.account"}',
							type: 'transfer'
						}
					}
				}
			})
		).toBe('0x22db3e32a50eac722e9ee18fbedf6a049885b379bfe887a0792e69efe660b58f');
	});
});
