import type { Address, Hex } from "viem";

import { measurePerformance } from "../../performance/runtime";

type Fetcher = typeof fetch;

type Challenge = {
	challengeId: string;
	message: string;
	expiresAt: number;
};

export type Session = {
	wallet: Address;
	expiresAt: number;
};

export type Profile = {
	wallet: Address;
	username: string | null;
	updatedAt: number | null;
};

type ApiErrorEnvelope = {
	error?: { code?: string; message?: string };
};

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as ApiErrorEnvelope;
		throw new Error(
			body.error?.message ?? `BabySteps API failed (${response.status}).`,
		);
	}
	return (await response.json()) as T;
}

export function createIdentityApi(apiUrl: string, fetcher: Fetcher = fetch) {
	const endpoint = (path: string) => `${apiUrl.replace(/\/$/u, "")}${path}`;
	const request = (path: string, init?: RequestInit) =>
		fetcher(endpoint(path), { credentials: "include", ...init });

	return {
		async login(
			address: Address,
			signMessage: (message: string) => Promise<string>,
		): Promise<Session> {
			const challenge = await measurePerformance("auth.challenge", () =>
				request("/api/auth/challenges", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ address, action: "login" }),
				}).then(readJson<Challenge>),
			);
			const signature = (await measurePerformance("auth.sign", () =>
				signMessage(challenge.message),
			)) as Hex;
			return measurePerformance("auth.verify", () =>
				request("/api/auth/sessions", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						challengeId: challenge.challengeId,
						message: challenge.message,
						signature,
					}),
				}).then(readJson<Session>),
			);
		},

		async getProfile(): Promise<Profile> {
			return readJson<Profile>(await request("/api/profile"));
		},

		async updateProfile(username: string): Promise<Profile> {
			return readJson<Profile>(
				await request("/api/profile", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ username }),
				}),
			);
		},

		async logout(): Promise<void> {
			const response = await request("/api/auth/logout", { method: "POST" });
			if (!response.ok && response.status !== 401) await readJson(response);
		},
	};
}
