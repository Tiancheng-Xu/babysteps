import { Hono } from "hono";
import { errorEnvelope } from "./http/respond";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (context) =>
	context.json({
		status: "ok",
		service: "babysteps-worker",
		schemaVersion: 1,
	}),
);

app.notFound((context) =>
	context.json(errorEnvelope("NOT_FOUND", "Route not found"), 404),
);
