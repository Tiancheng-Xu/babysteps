import { env } from "cloudflare:workers";
import { app } from "../../src/app";

export function request(input: RequestInfo | URL, init?: RequestInit) {
	return app.request(input, init, env);
}
