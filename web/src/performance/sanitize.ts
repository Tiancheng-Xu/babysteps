const identifierPattern =
	/^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|0x[0-9a-f]{8,})$/iu;

export function normalizeRoute(value: string): string {
	try {
		const url = new URL(value, "https://babysteps.invalid");
		const path = url.pathname
			.split("/")
			.map((segment) => (identifierPattern.test(segment) ? ":id" : segment))
			.join("/");
		return path || "/";
	} catch {
		return "/";
	}
}

export function safeMetricName(value: string): string {
	return value.replace(/[^a-z0-9._-]/giu, "_").slice(0, 64) || "unknown";
}
