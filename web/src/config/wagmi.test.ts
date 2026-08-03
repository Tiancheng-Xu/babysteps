import { describe, expect, it } from "vitest";
import { sepolia } from "wagmi/chains";

import { wagmiConfig } from "./wagmi";

describe("wagmiConfig", () => {
	it("uses the verified Sepolia RPC instead of the rate-limited default", () => {
		const client = wagmiConfig.getClient({ chainId: sepolia.id });

		expect(client.transport.url).toBe(
			"https://ethereum-sepolia-rpc.publicnode.com",
		);
	});
});
