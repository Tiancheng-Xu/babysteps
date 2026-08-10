import { Hono } from "hono";
import type { WorkerApp } from "./auth/session";
import type { MarketplaceReaderFactory } from "./chain/marketplaceReader";
import { createViemMarketplaceReader } from "./chain/viemMarketplaceReader";
import { AppError } from "./http/errors";
import { errorEnvelope } from "./http/respond";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { createTaskRoutes } from "./routes/tasks";

export type AppDependencies = {
	marketplaceReaderFactory?: MarketplaceReaderFactory;
};

export function createApp(_dependencies: AppDependencies = {}) {
	const application = new Hono<WorkerApp>();
	const marketplaceReaderFactory =
		_dependencies.marketplaceReaderFactory ?? createViemMarketplaceReader;

	application.get("/api/health", (context) =>
		context.json({
			status: "ok",
			service: "babysteps-worker",
			schemaVersion: 1,
		}),
	);

	application.route("/api/auth", authRoutes);
	application.route("/api/profile", profileRoutes);
	application.route("/api", createTaskRoutes(marketplaceReaderFactory));

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
