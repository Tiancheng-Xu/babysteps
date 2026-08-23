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

export function classifyErrorCategory(
	value: unknown,
): "type_error" | "network" | "timeout" | "unknown" {
	const message = value instanceof Error ? value.message : String(value ?? "");
	if (/typeerror/iu.test(message)) return "type_error";
	if (/network|failed to fetch|load failed/iu.test(message)) return "network";
	if (/timeout|timed out/iu.test(message)) return "timeout";
	return "unknown";
}
