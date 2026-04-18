export type TransferInput = {
	amount: string; // satoshis as decimal string
	to: string; // Magi address
	from?: string; // for transferFrom; caller must have sufficient allowance
};

export type UnmapInput = {
	amount: string; // satoshis as decimal string
	to: string; // BTC address
	from?: string; // for allowance-delegated spending
	deduct_fee?: boolean;
	max_fee?: number; // maximum VSC + BTC fee in satoshis
};

export type AllowanceInput = {
	spender: string;
	amount: string; // satoshis as decimal string; absolute for approve, delta for increase/decrease
};
