import { describe, expect, it } from "vitest";

import {
	deriveIdentitySummary,
	normalizeUsername,
	requiredPrivyLoginMethods,
} from "./identityModel";

describe("Privy identity model", () => {
	it("keeps the homework login methods explicit", () => {
		expect(requiredPrivyLoginMethods).toEqual(["google", "email", "wallet"]);
	});

	it("recognizes social identity, external wallet, and smart wallet separately", () => {
		expect(
			deriveIdentitySummary([
				{ type: "google_oauth", email: "parent@example.com" },
				{
					type: "wallet",
					address: "0x1111111111111111111111111111111111111111",
				},
				{
					type: "smart_wallet",
					address: "0x2222222222222222222222222222222222222222",
				},
			]),
		).toEqual({
			hasGoogle: true,
			hasEmail: false,
			externalWallet: "0x1111111111111111111111111111111111111111",
			smartWallet: "0x2222222222222222222222222222222222222222",
		});
	});

	it("uses the same safe username boundary as the Worker", () => {
		expect(normalizeUsername("  星宝家长  ")).toBe("星宝家长");
		expect(() => normalizeUsername("a")).toThrow(/2 to 32/u);
		expect(() => normalizeUsername("<parent>")).toThrow(/safe/u);
	});
});
