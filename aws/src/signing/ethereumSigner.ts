import type { Address, Hex, TransactionSerializableEIP1559 } from "viem";

export interface EthereumSigner {
	getAddress(): Promise<Address>;
	signTransaction(transaction: TransactionSerializableEIP1559): Promise<Hex>;
}
