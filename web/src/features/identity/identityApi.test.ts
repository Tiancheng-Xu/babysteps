import { describe, expect, it, vi } from "vitest";

import { createIdentityApi } from "./identityApi";

describe("identity API client", () => {
	it("completes challenge-sign-verify without exposing a private key", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						challengeId: "d70b4a9e-71cb-43fe-8dc6-29d5f2d52621",
						message: "BabySteps wants you to sign in",
						expiresAt: 1_800_000_000,
					}),
					{ status: 201, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						wallet: "0x1111111111111111111111111111111111111111",
						expiresAt: 1_800_086_400,
					}),
					{ status: 201, headers: { "content-type": "application/json" } },
				),
			);
		const signMessage = vi.fn().mockResolvedValue(`0x${"ab".repeat(65)}`);
		const api = createIdentityApi("https://api.example.com", fetcher);

		await expect(
			api.login("0x1111111111111111111111111111111111111111", signMessage),
		).resolves.toMatchObject({ expiresAt: 1_800_086_400 });
		expect(signMessage).toHaveBeenCalledWith("BabySteps wants you to sign in");
		expect(fetcher).toHaveBeenNthCalledWith(
			2,
			"https://api.example.com/api/auth/sessions",
			expect.objectContaining({ credentials: "include", method: "POST" }),
		);
	});
});
