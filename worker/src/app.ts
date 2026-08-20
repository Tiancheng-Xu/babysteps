import { Hono } from "hono";
import { cors } from "hono/cors";
import type { WorkerApp } from "./auth/session";
import type { MarketplaceReaderFactory } from "./chain/marketplaceReader";
import { createViemMarketplaceReader } from "./chain/viemMarketplaceReader";
import { readConfig } from "./config";
import { AppError } from "./http/errors";
import { errorEnvelope } from "./http/respond";
import {
	createPerformanceRoutes,
	type PerformanceFetch,
} from "./performanceProxy";
import { authRoutes } from "./routes/auth";
import {
	createCommentRoutes,
	type OwnerWalletFactory,
} from "./routes/comments";
import { profileRoutes } from "./routes/profile";
import { createTaskRoutes } from "./routes/tasks";

export type AppDependencies = {
	marketplaceReaderFactory?: MarketplaceReaderFactory;
	ownerWalletFactory?: OwnerWalletFactory;
	performanceFetch?: PerformanceFetch;
};

export function createApp(_dependencies: AppDependencies = {}) {
	const application = new Hono<WorkerApp>();
	const marketplaceReaderFactory =
		_dependencies.marketplaceReaderFactory ?? createViemMarketplaceReader;
	const ownerWalletFactory =
		_dependencies.ownerWalletFactory ??
		((env: Env) => readConfig(env).ownerWallet);

	application.use(
		"/api/*",
		cors({
			origin: (origin, context) => {
				const allowedOrigin = new URL(readConfig(context.env).uri).origin;
				return origin === allowedOrigin ? origin : null;
			},
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
			credentials: true,
			maxAge: 86_400,
		}),
	);

	application.use("*", async (context, next) => {
		const requestId = crypto.randomUUID();
		const startedAt = Date.now();
		context.set("requestId", requestId);
		try {
			await next();
			console.log(
				JSON.stringify({
					requestId,
					method: context.req.method,
					path: context.req.path,
					status: context.res.status,
					durationMs: Date.now() - startedAt,
				}),
			);
		} catch (error) {
			console.log(
				JSON.stringify({
					requestId,
					method: context.req.method,
					path: context.req.path,
					status: error instanceof AppError ? error.status : 500,
					durationMs: Date.now() - startedAt,
				}),
			);
			throw error;
		}
	});

	application.get("/api/health", (context) =>
		context.json({
			status: "ok",
			service: "babysteps-worker",
			schemaVersion: 1,
		}),
	);

	application.route("/api/auth", authRoutes);
	application.route("/api/profile", profileRoutes);
	application.route(
		"/api/performance",
		createPerformanceRoutes(_dependencies.performanceFetch),
	);
	application.route("/api", createTaskRoutes(marketplaceReaderFactory));
	application.route(
		"/api",
		createCommentRoutes(marketplaceReaderFactory, ownerWalletFactory),
	);

	application.onError((error, context) => {
		if (error instanceof AppError) {
			return context.json(
				errorEnvelope(error.code, error.message),
				error.status,
			);
		}

		console.error(JSON.stringify({ level: "error", code: "UNEXPECTED_ERROR" }));
		return context.json(
			errorEnvelope("INTERNAL_ERROR", "Internal server error"),
			500,
		);
	});

	application.notFound((context) =>
		context.json(errorEnvelope("NOT_FOUND", "Route not found"), 404),
	);

	return application;
}

export const app = createApp();
