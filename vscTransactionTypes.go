type TxVSCTransfer struct {
	Self  TxSelf
	NetId string `json:"net_id"`

	From   string `json:"from"`
	To     string `json:"to"`
	Amount string `json:"amount"`
	Asset  string `json:"asset"`
	Memo   string `json:"memo"`
}
type TxConsensusStake struct {
	Self TxSelf

	From   string `json:"from"`
	To     string `json:"to"`
	Amount string `json:"amount"`
	Asset  string `json:"asset"`
	NetId  string `json:"net_id"`
}

type TxConsensusUnstake struct {
	Self TxSelf

	From   string `json:"from"`
	To     string `json:"to"`
	Amount string `json:"amount"`
	Asset  string `json:"asset"`
	NetId  string `json:"net_id"`
}