import { env } from "cloudflare:workers";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { cookieFrom, createChallenge, createSession } from "./helpers/auth";
import { request } from "./helpers/request";

function testAccount() {
	return privateKeyToAccount(generatePrivateKey());
}

describe("challenge-sign-verify authentication", () => {
	it("creates a five-minute challenge and a secure session", async () => {
		const account = testAccount();
		const challenge = await createChallenge(account);

		expect(challenge.message).toContain("BabySteps wants you to sign in");
		expect(challenge.message).toContain(`Address: ${account.address}`);
		expect(challenge.message).toContain("Domain: babysteps.baby2b.online");
		expect(challenge.message).toContain("Chain ID: 11155111");
		expect(challenge.message).toContain("Action: login");
		expect(challenge.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

		const response = await createSession(account, challenge);

		expect(response.status).toBe(201);
		const setCookie = response.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("__Host-babysteps_session=");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("Secure");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).toContain("Path=/");
		expect(setCookie).not.toContain("Domain=");

		const nonce = challenge.message.match(/Nonce: (.+)/)?.[1];
		const token = cookieFrom(response).split("=", 2)[1];
		const storedChallenge = await env.DB.prepare(
			"SELECT nonce_hash FROM auth_challenges WHERE id = ?",
		)
			.bind(challenge.challengeId)
			.first<{ nonce_hash: string }>();
		const storedSession = await env.DB.prepare(
			"SELECT token_hash FROM sessions WHERE wallet = ?",
		)
			.bind(account.address.toLowerCase())
			.first<{ token_hash: string }>();

		expect(nonce).toBeTruthy();
		expect(storedChallenge?.nonce_hash).not.toBe(nonce);
		expect(storedSession?.token_hash).not.toBe(token);
	});

	it("rejects unsupported actions", async () => {
		const account = testAccount();
		const response = await request("/api/auth/challenges", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				address: account.address,
				action: "transfer-funds",
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "AUTH_ACTION_INVALID" },
		});
	});

	it("rejects a signature from a different wallet", async () => {
		const account = testAccount();
		const attacker = testAccount();
		const challenge = await createChallenge(account);
		const signature = await attacker.signMessage({
			message: challenge.message,
		});
		const response = await request("/api/auth/sessions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				challengeId: challenge.challengeId,
				message: challenge.message,
				signature,
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "AUTH_SIGNATURE_INVALID" },
		});
	});

	it("rejects an altered signed message", async () => {
		const account = testAccount();
		const challenge = await createChallenge(account);
		const altered = challenge.message.replace(
			"Action: login",
			"Action: update-profile",
		);
		const signature = await account.signMessage({ message: altered });
		const response = await request("/api/auth/sessions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				challengeId: challenge.challengeId,
				message: altered,
				signature,
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "AUTH_MESSAGE_MISMATCH" },
		});
	});

	it("atomically permits only one concurrent challenge consumption", async () => {
		const account = testAccount();
		const challenge = await createChallenge(account);
		const signature = await account.signMessage({ message: challenge.message });
		const payload = JSON.stringify({
			challengeId: challenge.challengeId,
			message: challenge.message,
			signature,
		});
		const requests = [1, 2].map(() =>
			request("/api/auth/sessions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: payload,
			}),
		);

		const responses = await Promise.all(requests);
		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
		const rejected = responses.find(({ status }) => status === 409);
		await expect(rejected?.json()).resolves.toMatchObject({
			error: { code: "AUTH_CHALLENGE_USED" },
		});
	});

	it("rejects an expired challenge", async () => {
		const account = testAccount();
		const challenge = await createChallenge(account);
		await env.DB.prepare(
			"UPDATE auth_challenges SET expires_at = 0 WHERE id = ?",
		)
			.bind(challenge.challengeId)
			.run();

		const response = await createSession(account, challenge);
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "AUTH_CHALLENGE_EXPIRED" },
		});
	});

	it("revokes the current session on logout", async () => {
		const account = testAccount();
		const challenge = await createChallenge(account);
		const session = await createSession(account, challenge);
		const response = await request("/api/auth/logout", {
			method: "POST",
			headers: { cookie: cookieFrom(session) },
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
		const stored = await env.DB.prepare(
			"SELECT revoked_at FROM sessions WHERE wallet = ?",
		)
			.bind(account.address.toLowerCase())
			.first<{ revoked_at: number | null }>();
		expect(stored?.revoked_at).toBeTypeOf("number");
	});
});
