import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { getAddress, isAddress, recoverMessageAddress } from "viem";
import { z } from "zod";
import { buildAuthMessage } from "../auth/message";
import {
	requireSession,
	SESSION_COOKIE_NAME,
	SESSION_LIFETIME_SECONDS,
	type WorkerApp,
} from "../auth/session";
import { readConfig } from "../config";
import { AppError, readJson } from "../http/errors";
import { AuthRepository } from "../repositories/authRepository";
import { sha256Hex } from "../security/digests";
import { randomHex, randomToken } from "../security/random";

const allowedActions = [
	"login",
	"update-profile",
	"create-task-draft",
	"bind-task",
	"create-comment",
	"edit-comment",
	"moderate-comment",
] as const;

const challengeSchema = z.object({
	address: z.string(),
	action: z.string(),
});

const sessionSchema = z.object({
	challengeId: z.uuid(),
	message: z.string().min(1),
	signature: z.string().regex(/^0x[0-9a-fA-F]+$/u),
});

export const authRoutes = new Hono<WorkerApp>();

authRoutes.post("/challenges", async (context) => {
	const input = challengeSchema.safeParse(await readJson(context.req.raw));
	if (!input.success || !isAddress(input.data.address)) {
		throw new AppError(
			400,
			"AUTH_REQUEST_INVALID",
			"Wallet address and action are required",
		);
	}
	if (
		!allowedActions.includes(
			input.data.action as (typeof allowedActions)[number],
		)
	) {
		throw new AppError(
			400,
			"AUTH_ACTION_INVALID",
			"Authentication action is not allowed",
		);
	}

	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + 5 * 60;
	const nonce = randomHex(16);
	const address = getAddress(input.data.address);
	const config = readConfig(context.env);
	const message = buildAuthMessage(config, {
		address,
		action: input.data.action,
		nonce,
		issuedAt: now,
		expiresAt,
	});
	const id = crypto.randomUUID();

	await new AuthRepository(context.env.DB).createChallenge({
		id,
		wallet: address.toLowerCase(),
		action: input.data.action,
		nonce_hash: await sha256Hex(nonce),
		message,
		expires_at: expiresAt,
		used_at: null,
		created_at: now,
	});

	return context.json({ challengeId: id, message, expiresAt }, 201);
});

authRoutes.post("/sessions", async (context) => {
	const input = sessionSchema.safeParse(await readJson(context.req.raw));
	if (!input.success) {
		throw new AppError(
			400,
			"AUTH_REQUEST_INVALID",
			"Challenge, message, and signature are required",
		);
	}

	const repository = new AuthRepository(context.env.DB);
	const challenge = await repository.findChallenge(input.data.challengeId);
	if (!challenge) {
		throw new AppError(401, "AUTH_CHALLENGE_INVALID", "Challenge is invalid");
	}
	if (challenge.message !== input.data.message) {
		throw new AppError(
			400,
			"AUTH_MESSAGE_MISMATCH",
			"Signed message does not match the challenge",
		);
	}
	const now = Math.floor(Date.now() / 1000);
	if (challenge.used_at !== null) {
		throw new AppError(
			409,
			"AUTH_CHALLENGE_USED",
			"Challenge has already been used",
		);
	}
	if (challenge.expires_at <= now) {
		throw new AppError(401, "AUTH_CHALLENGE_EXPIRED", "Challenge has expired");
	}

	let recoveredAddress: string;
	try {
		recoveredAddress = await recoverMessageAddress({
			message: input.data.message,
			signature: input.data.signature as `0x${string}`,
		});
	} catch {
		throw new AppError(401, "AUTH_SIGNATURE_INVALID", "Signature is invalid");
	}
	if (recoveredAddress.toLowerCase() !== challenge.wallet) {
		throw new AppError(401, "AUTH_SIGNATURE_INVALID", "Signature is invalid");
	}

	if (!(await repository.consumeChallenge(challenge.id, now))) {
		const current = await repository.findChallenge(challenge.id);
		if (current?.used_at !== null) {
			throw new AppError(
				409,
				"AUTH_CHALLENGE_USED",
				"Challenge has already been used",
			);
		}
		throw new AppError(401, "AUTH_CHALLENGE_EXPIRED", "Challenge has expired");
	}

	const token = randomToken();
	const expiresAt = now + SESSION_LIFETIME_SECONDS;
	await repository.createSession({
		id: crypto.randomUUID(),
		wallet: challenge.wallet,
		token_hash: await sha256Hex(token),
		expires_at: expiresAt,
		revoked_at: null,
		created_at: now,
	});
	setCookie(context, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_LIFETIME_SECONDS,
	});

	return context.json({ wallet: challenge.wallet, expiresAt }, 201);
});

authRoutes.post("/logout", requireSession, async (context) => {
	await new AuthRepository(context.env.DB).revokeSession(
		context.get("sessionId"),
		Math.floor(Date.now() / 1000),
	);
	setCookie(context, SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 0,
	});

	return context.body(null, 204);
});
