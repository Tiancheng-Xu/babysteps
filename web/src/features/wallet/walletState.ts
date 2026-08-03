import type { Address } from "viem";
import { sepolia } from "wagmi/chains";

export type WalletState =
	| "missing"
	| "disconnected"
	| "wrong-network"
	| "ready";

type WalletStateInput = {
	hasProvider: boolean;
	isConnected: boolean;
	address?: Address;
	chainId?: number;
};

type InjectedWindow = Window & {
	ethereum?: { isMetaMask?: boolean };
};

export function hasMetaMaskProvider() {
	return (
		typeof window !== "undefined" &&
		(window as InjectedWindow).ethereum?.isMetaMask === true
	);
}

export function deriveWalletState({
	hasProvider,
	isConnected,
	address,
	chainId,
}: WalletStateInput): WalletState {
	if (!hasProvider) return "missing";
	if (!isConnected || !address) return "disconnected";
	return chainId === sepolia.id ? "ready" : "wrong-network";
}
