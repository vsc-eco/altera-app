export type TransferInput = {
	amount: number;
	// TODO: change to magi once official contract is pushed
	recipient_vsc_address: string;
};

export type UnmapInput = {
	amount: number;
	recipient_btc_address: string;
};
