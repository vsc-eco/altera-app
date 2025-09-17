import { getQuerier } from './query';

export type Metadata = {
	message: string;
	version: string;
	config: {
		hive_return_fee: number;
		conv_fee_percent: number;
		conv_fee_sats: number;
		minimum_invoice_payment_sats: number;
		maximum_invoice_payment_sats: number;
		max_acceptable_lnd_fee_msats: number;
		closed_get_lnd: boolean;
		closed_get_hive: boolean;
		v4v_frontend_iri: string;
		v4v_api_iri: string;
		v4v_fees_streaming_sats_to_hive_percent: number;
		lightning_rate_limits: Array<{
			hours: number;
			limit: number;
		}>;
		dynamic_fees_url: string;
		dynamic_fees_permlink: string;
		binance_automated_sell: boolean;
		binance_force_min_sell: boolean;
		binance_force_testnet: boolean;
		binance_ignore_account: string;
		min_max: {
			min: {
				conv_from: string;
				sats: number;
				HIVE: number;
				HBD: number;
				USD: number;
			};
			max: {
				conv_from: string;
				sats: number;
				HIVE: number;
				HBD: number;
				USD: number;
			};
		};
	};
	onward_response: {
		state: string;
	};
};

export const getV4VMetadata = getQuerier<Metadata>(
	'https://api.v4v.app/v1?get_crypto=false',
	5 * 60 // refresh every 5 mins at most
);
