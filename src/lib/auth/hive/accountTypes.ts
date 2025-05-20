/**
 * Example: '2025-01-28T11:06:42'
 */
type DateString = string;
/**
 * Example: '{"beneficiaries":[{"name":"dbuzz","weight":300,"label":"referrer"},{"name":"dbuzz","weight":100,"label":"creator"},{"name":"dbuzz","weight":100,"label":"provider"}],"profile":{"profile_image":"https://0.gravatar.com/avatar/558c6631c13e113732b4fe81263363c3c5b00fbc102ae70a04db523353f34bec?size=256","cover_image":"https://1.gravatar.com/userimage/247906009/2ce55599d55c2a9f758df6b43ace0536?size=1024","version":2,"name":"Zephiris","about":"they/them; @zphrs on github.","website":"https://zephiris.me"}}'
 */

type UrlString = string;
type ImageUrlString = UrlString;

type Username = string;

type MetadataJsonString = string;
export type MetadataJson = {
	beneficiaries: Beneficiaries;
};
type PostingJsonMetadataString = string;

export type Beneficiaries = {
	name: string;
	weight: number;
	label: 'referrer' | 'creator' | 'provider' | string;
}[];

export function postingMetadataFromString(str: PostingJsonMetadataString): PostingMetadata {
	if (str == '') return { profile: {} };
	return JSON.parse(str);
}
export type PostingMetadata = {
	beneficiaries?: Beneficiaries;
	profile: {
		profile_image?: ImageUrlString;
		cover_image?: ImageUrlString;
		version?: number;
		name?: string;
		about?: string;
		website?: UrlString;
		location?: string;
	};
};

export function dateFromString(str: DateString): Date {
	return new Date(str);
}
export type Account = {
	active: {
		account_auths: unknown[];
		key_auths: [string, number][];
		weight_threshold: 1;
	};
	balance: `${number} HIVE`;
	can_vote: boolean;
	comment_count: number;
	/**Date, example: '2025-01-28T11:06:42'*/
	created: DateString;
	curation_rewards: number;
	delayed_votes: [];
	delegated_vesting_shares: `${number} VESTS`;
	downvote_manabar: {
		current_mana: number;
		last_update_time: number;
	};
	governance_vote_expiration_ts: DateString;
	guest_bloggers: [];
	hbd_balance: `${number} HBD`;
	hbd_last_interest_payment: DateString;
	hbd_seconds: '${number}';
	hbd_seconds_last_update: DateString;
	id: number;
	json_metadata: MetadataJsonString;
	last_account_recovery: DateString;
	last_account_update: DateString;
	last_owner_update: DateString;
	last_post: DateString;
	last_root_post: DateString;
	last_vote_time: DateString;
	lifetime_vote_count: number;
	market_history: unknown[];
	memo_key: string;
	mined: false;
	name: Username;
	next_vesting_withdrawal: DateString;
	open_recurrent_transfers: number;
	other_history: unknown[];
	owner: {
		account_auths: unknown[];
		key_auths: [string, number][];
		weight_threshold: number;
	};
	pending_claimed_accounts: number;
	pending_transfers: number;
	post_bandwidth: number;
	post_count: number;
	post_history: unknown[];
	post_voting_power: `${number} VESTS`;
	posting: {
		account_auths: [string, number][];
		key_auths: [string, number][];
		weight_threshold: 1;
	};
	posting_json_metadata: PostingJsonMetadataString;
	posting_rewards: number;
	previous_owner_update: DateString;
	proxied_vsf_votes: [number, number, number, number];
	proxy: string;
	received_vesting_shares: `${number} VESTS`;
	recovery_account: 'dbuzz';
	reputation: number;
	reset_account: 'null';
	reward_hbd_balance: `${number} HBD`;
	reward_hive_balance: `${number} HIVE`;
	reward_vesting_balance: `${number} VESTS`;
	reward_vesting_hive: `${number} HIVE`;
	savings_balance: `${number} HIVE`;
	savings_hbd_balance: `${number} HBD`;
	savings_hbd_last_interest_payment: DateString;
	savings_hbd_seconds: '0';
	savings_hbd_seconds_last_update: DateString;
	savings_withdraw_requests: number;
	tags_usage: unknown[];
	to_withdraw: number;
	transfer_history: [];
	vesting_balance: `${number} HIVE`;
	vesting_shares: `${number} VESTS`;
	vesting_withdraw_rate: `${number} VESTS`;
	vote_history: [];
	voting_manabar: {
		current_mana: number;
		last_update_time: number;
	};
	voting_power: number;
	withdraw_routes: number;
	withdrawn: number;
	witness_votes: string[];
	witnesses_voted_for: number;
};
export type AccountResult = {
	result: Account[];
};
