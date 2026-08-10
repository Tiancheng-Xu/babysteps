import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { AppError } from "../http/errors";
import { AuthRepository } from "../repositories/authRepository";
import { sha256Hex } from "../security/digests";

export const SESSION_COOKIE_NAME = "__Host-babysteps_session";
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

export type WorkerApp = {
	Bindings: Env;
	Variables: {
		wallet: string;
		sessionId: string;
		requestId: string;
	};
};

export const requireSession: MiddlewareHandler<WorkerApp> = async (
	context,
	next,
) => {
	const token = getCookie(context, SESSION_COOKIE_NAME);
	if (!token) {
		throw new AppError(
			401,
			"AUTH_SESSION_INVALID",
			"A valid session is required",
		);
	}

	const tokenHash = await sha256Hex(token);
	const session = await new AuthRepository(context.env.DB).findLiveSession(
		tokenHash,
		Math.floor(Date.now() / 1000),
	);
	if (!session) {
		throw new AppError(
			401,
			"AUTH_SESSION_INVALID",
			"A valid session is required",
		);
	}

	context.set("wallet", session.wallet);
	context.set("sessionId", session.id);
	await next();
};
