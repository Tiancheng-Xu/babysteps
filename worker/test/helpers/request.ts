import { env } from "cloudflare:workers";
import { app } from "../../src/app";

export type TestRequest = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Response | Promise<Response>;

export function requestFor(target: Pick<typeof app, "request">): TestRequest {
	return (input, init) => target.request(input, init, env);
}

export const request = requestFor(app);
