import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
	constructor(
		readonly status: ContentfulStatusCode,
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new AppError(
			400,
			"REQUEST_JSON_INVALID",
			"Request body must be valid JSON",
		);
	}
}
