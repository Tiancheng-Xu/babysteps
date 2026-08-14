import { renderRouteStream } from "./entry-server";
import { routeForPath } from "./routing/routeDefinitions";
import { buildCsrFallbackDocument, composeSsrDocument } from "./ssr/html";
import type { RenderState } from "./ssr/renderState";
import { classifyRequest } from "./ssr/requestPolicy";

export type PagesEnvironment = {
	ASSETS: { fetch(request: Request): Promise<Response> };
};

type RenderRoute = (
	pathname: string,
	signal: AbortSignal,
) => Promise<ReadableStream<Uint8Array>>;

type HandlerOptions = {
	render?: RenderRoute;
	timeoutMs?: number;
	version?: string;
	now?: () => number;
	logger?: Pick<Console, "info" | "error">;
};

const SECURITY_HEADERS = {
	"content-security-policy":
		"base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
	"referrer-policy": "strict-origin-when-cross-origin",
	"x-content-type-options": "nosniff",
	"x-frame-options": "DENY",
} as const;

class RenderTimeoutError extends Error {
	constructor() {
		super("SSR exceeded its hard timeout.");
		this.name = "RenderTimeoutError";
	}
}

function documentHeaders(mode: "ssr" | "csr-fallback", cacheControl: string) {
	return new Headers({
		...SECURITY_HEADERS,
		"cache-control": cacheControl,
		"content-type": "text/html; charset=utf-8",
		vary: "Accept",
		"x-babysteps-render-mode": mode,
	});
}

async function loadClientTemplate(
	request: Request,
	environment: PagesEnvironment,
): Promise<Response> {
	const url = new URL("/index.html", request.url);
	return environment.ASSETS.fetch(
		new Request(url, { headers: { accept: "text/html" } }),
	);
}

async function renderWithTimeout(
	render: RenderRoute,
	pathname: string,
	timeoutMs: number,
): Promise<Uint8Array> {
	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const renderAndRead = async () => {
		const stream = await render(pathname, controller.signal);
		const reader = stream.getReader();
		const chunks: Uint8Array[] = [];
		let length = 0;
		const cancel = () => void reader.cancel(controller.signal.reason);
		controller.signal.addEventListener("abort", cancel, { once: true });
		try {
			while (true) {
				const result = await reader.read();
				if (result.done) break;
				chunks.push(result.value);
				length += result.value.byteLength;
			}
		} finally {
			controller.signal.removeEventListener("abort", cancel);
		}
		const output = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			output.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return output;
	};
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			reject(new RenderTimeoutError());
		}, timeoutMs);
	});
	try {
		return await Promise.race([renderAndRead(), timeout]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

function completedStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

export function createPagesHandler(options: HandlerOptions = {}) {
	const render = options.render ?? renderRouteStream;
	const timeoutMs = options.timeoutMs ?? 2_500;
	const version =
		options.version ?? import.meta.env.VITE_APP_VERSION ?? "unknown";
	const now = options.now ?? Date.now;
	const logger = options.logger ?? console;

	return {
		async fetch(
			request: Request,
			environment: PagesEnvironment,
		): Promise<Response> {
			const classification = classifyRequest(request);
			if (classification.kind === "asset") {
				return environment.ASSETS.fetch(request);
			}

			const startedAt = now();
			const url = new URL(request.url);
			const templateResponse = await loadClientTemplate(request, environment);
			if (!templateResponse.ok) return templateResponse;
			const template = await templateResponse.text();
			const state: RenderState = {
				mode: "ssr",
				pathname: url.pathname,
				version,
			};

			try {
				const app = await renderWithTimeout(render, url.pathname, timeoutMs);
				const isPersonalized =
					routeForPath(url.pathname)?.renderPolicy === "client-shell";
				const isRequestSpecific =
					url.search.length > 0 ||
					request.headers.has("authorization") ||
					request.headers.has("cookie");
				const headers = documentHeaders(
					"ssr",
					isPersonalized || isRequestSpecific || classification.status === 404
						? "private, no-store"
						: "public, max-age=0, must-revalidate",
				);
				logger.info(
					JSON.stringify({
						event: "render.complete",
						mode: "ssr",
						pathname: url.pathname,
						status: classification.status,
						durationMs: now() - startedAt,
					}),
				);
				return new Response(
					request.method === "HEAD"
						? null
						: composeSsrDocument(template, completedStream(app), state),
					{ status: classification.status, headers },
				);
			} catch (error) {
				const reason =
					error instanceof RenderTimeoutError ? "timeout" : "render-error";
				logger.error(
					JSON.stringify({
						event: "render.fallback",
						mode: "csr-fallback",
						pathname: url.pathname,
						reason,
						durationMs: now() - startedAt,
					}),
				);
				const fallbackState: RenderState = { ...state, mode: "csr-fallback" };
				return new Response(
					request.method === "HEAD"
						? null
						: buildCsrFallbackDocument(template, fallbackState),
					{
						status: classification.status,
						headers: documentHeaders("csr-fallback", "no-store"),
					},
				);
			}
		},
	};
}

export default createPagesHandler();
