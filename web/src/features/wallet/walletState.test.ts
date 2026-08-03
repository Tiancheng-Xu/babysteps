import { describe, expect, it } from "vitest";

import { deriveWalletState } from "./walletState";

describe("deriveWalletState", () => {
	it("keeps wallet absence, disconnection, and network mismatch distinct", () => {
		expect(deriveWalletState({ hasProvider: false, isConnected: false })).toBe(
			"missing",
		);
		expect(deriveWalletState({ hasProvider: true, isConnected: false })).toBe(
			"disconnected",
		);
		expect(
			deriveWalletState({
				hasProvider: true,
				isConnected: true,
				address: "0x1111111111111111111111111111111111111111",
				chainId: 1,
			}),
		).toBe("wrong-network");
	});

	it("reports ready only for a connected Sepolia account", () => {
		expect(
			deriveWalletState({
				hasProvider: true,
				isConnected: true,
				address: "0x1111111111111111111111111111111111111111",
				chainId: 11155111,
			}),
		).toBe("ready");
	});
});
