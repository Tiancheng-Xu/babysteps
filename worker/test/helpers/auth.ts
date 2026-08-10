import type { PrivateKeyAccount } from "viem";
import { request, type TestRequest } from "./request";

export type ChallengeResponse = {
	challengeId: string;
	message: string;
	expiresAt: number;
};

export async function createChallenge(
	account: PrivateKeyAccount,
	action = "login",
	requester: TestRequest = request,
): Promise<ChallengeResponse> {
	const response = await requester("/api/auth/challenges", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ address: account.address, action }),
	});

	if (response.status !== 201) {
		throw new Error(
			`Challenge failed with ${response.status}: ${await response.text()}`,
		);
	}

	return response.json<ChallengeResponse>();
}

export async function createSession(
	account: PrivateKeyAccount,
	challenge: ChallengeResponse,
	requester: TestRequest = request,
): Promise<Response> {
	const signature = await account.signMessage({ message: challenge.message });

	return requester("/api/auth/sessions", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			challengeId: challenge.challengeId,
			message: challenge.message,
			signature,
		}),
	});
}

export function cookieFrom(response: Response): string {
	const setCookie = response.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error("Missing session cookie");
	}

	return setCookie.split(";", 1)[0];
}
