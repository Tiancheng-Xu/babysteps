import { routeForPath } from "../routing/routeDefinitions";

export type RequestClassification =
	| { kind: "asset" }
	| { kind: "document"; status: 200 | 404 };

const STATIC_PREFIXES = ["/assets/", "/metadata/", "/screenshots/"];
const STATIC_FILENAMES = new Set([
	"/favicon.ico",
	"/manifest.webmanifest",
	"/robots.txt",
	"/sitemap.xml",
]);

function looksLikeStaticAsset(pathname: string): boolean {
	if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
		return true;
	if (STATIC_FILENAMES.has(pathname)) return true;
	const lastSegment = pathname.split("/").at(-1) ?? "";
	return lastSegment.includes(".");
}

export function classifyRequest(request: Request): RequestClassification {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return { kind: "asset" };
	}

	const url = new URL(request.url);
	if (
		url.pathname === "/api" ||
		url.pathname.startsWith("/api/") ||
		looksLikeStaticAsset(url.pathname)
	) {
		return { kind: "asset" };
	}

	const accept = request.headers.get("accept") ?? "";
	if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
		return { kind: "asset" };
	}

	return {
		kind: "document",
		status: routeForPath(url.pathname) ? 200 : 404,
	};
}
