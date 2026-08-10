import { Hono } from "hono";
import type { WorkerApp } from "./auth/session";
import { AppError } from "./http/errors";
import { errorEnvelope } from "./http/respond";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";

export const app = new Hono<WorkerApp>();

app.get("/api/health", (context) =>
	context.json({
		status: "ok",
		service: "babysteps-worker",
		schemaVersion: 1,
	}),
);

app.route("/api/auth", authRoutes);
app.route("/api/profile", profileRoutes);

app.onError((error, context) => {
	if (error instanceof AppError) {
		return context.json(errorEnvelope(error.code, error.message), error.status);
	}

	console.error(JSON.stringify({ level: "error", code: "UNEXPECTED_ERROR" }));
	return context.json(
		errorEnvelope("INTERNAL_ERROR", "Internal server error"),
		500,
	);
});

app.notFound((context) =>
	context.json(errorEnvelope("NOT_FOUND", "Route not found"), 404),
);
