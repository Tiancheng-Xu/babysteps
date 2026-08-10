import { env } from "cloudflare:workers";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { cookieFrom, createChallenge, createSession } from "./helpers/auth";
import { request } from "./helpers/request";

function testAccount() {
	return privateKeyToAccount(generatePrivateKey());
}

async function login() {
	const account = testAccount();
	const challenge = await createChallenge(account);
	const response = await createSession(account, challenge);

	return { account, cookie: cookieFrom(response) };
}

describe("wallet profile", () => {
	it("requires a live session", async () => {
		const getResponse = await request("/api/profile");
		const putResponse = await request("/api/profile", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username: "Star Parent" }),
		});

		expect(getResponse.status).toBe(401);
		expect(putResponse.status).toBe(401);
	});

	it("creates, reads, and audits a trimmed username", async () => {
		const { account, cookie } = await login();
		const update = await request("/api/profile", {
			method: "PUT",
			headers: {
				"content-type": "application/json",
				cookie,
			},
			body: JSON.stringify({ username: "  星宝家长  " }),
		});

		expect(update.status).toBe(200);
		await expect(update.json()).resolves.toMatchObject({
			wallet: account.address.toLowerCase(),
			username: "星宝家长",
		});

		const get = await request("/api/profile", { headers: { cookie } });
		expect(get.status).toBe(200);
		await expect(get.json()).resolves.toMatchObject({ username: "星宝家长" });

		const audit = await env.DB.prepare(
			"SELECT action, actor_wallet, detail_json FROM audit_logs WHERE resource_type = 'profile'",
		).first<{ action: string; actor_wallet: string; detail_json: string }>();
		expect(audit).toMatchObject({
			action: "profile.updated",
			actor_wallet: account.address.toLowerCase(),
		});
		expect(JSON.parse(audit?.detail_json ?? "{}")).toEqual({
			oldUsername: null,
			newUsername: "星宝家长",
		});
	});

	it.each(["", "a", "<b>parent</b>", "parent\u0000name", "x".repeat(33)])(
		"rejects unsafe username %j",
		async (username) => {
			const { cookie } = await login();
			const response = await request("/api/profile", {
				method: "PUT",
				headers: { "content-type": "application/json", cookie },
				body: JSON.stringify({ username }),
			});

			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toMatchObject({
				error: { code: "PROFILE_USERNAME_INVALID" },
			});
		},
	);

	it("rejects expired and revoked sessions", async () => {
		const { account, cookie } = await login();
		await env.DB.prepare("UPDATE sessions SET expires_at = 0 WHERE wallet = ?")
			.bind(account.address.toLowerCase())
			.run();

		const expired = await request("/api/profile", { headers: { cookie } });
		expect(expired.status).toBe(401);
		await expect(expired.json()).resolves.toMatchObject({
			error: { code: "AUTH_SESSION_INVALID" },
		});
	});
});
