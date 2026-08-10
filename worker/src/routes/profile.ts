import { Hono } from "hono";
import { z } from "zod";
import { requireSession, type WorkerApp } from "../auth/session";
import { AppError, readJson } from "../http/errors";
import { ProfileRepository } from "../repositories/profileRepository";

const profileInputSchema = z.object({ username: z.string() }).strict();

function normalizeUsername(value: string): string {
	const username = value.trim();
	const length = [...username].length;
	const hasControlCharacter = [...username].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint <= 31 || codePoint === 127;
	});
	if (
		length < 2 ||
		length > 32 ||
		/[<>]/u.test(username) ||
		hasControlCharacter
	) {
		throw new AppError(
			400,
			"PROFILE_USERNAME_INVALID",
			"Username must be 2 to 32 safe characters",
		);
	}
	return username;
}

export const profileRoutes = new Hono<WorkerApp>();

profileRoutes.use("*", requireSession);

profileRoutes.get("/", async (context) => {
	const wallet = context.get("wallet");
	const profile = await new ProfileRepository(context.env.DB).find(wallet);

	return context.json({
		wallet,
		username: profile?.username ?? null,
		updatedAt: profile?.updated_at ?? null,
	});
});

profileRoutes.put("/", async (context) => {
	const input = profileInputSchema.safeParse(await readJson(context.req.raw));
	if (!input.success) {
		throw new AppError(
			400,
			"PROFILE_USERNAME_INVALID",
			"Username must be 2 to 32 safe characters",
		);
	}
	const profile = await new ProfileRepository(context.env.DB).update(
		context.get("wallet"),
		normalizeUsername(input.data.username),
		Math.floor(Date.now() / 1000),
	);

	return context.json({
		wallet: profile.wallet,
		username: profile.username,
		updatedAt: profile.updated_at,
	});
});
