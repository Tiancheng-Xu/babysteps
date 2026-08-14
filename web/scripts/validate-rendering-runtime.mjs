import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const template =
	'<!doctype html><html><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';

export async function validateBuiltRenderingRuntime(workerPath) {
	const moduleUrl = `${pathToFileURL(workerPath).href}?validation=${Date.now()}`;
	const worker = (await import(moduleUrl)).default;
	if (!worker || typeof worker.fetch !== "function") {
		throw new Error("Built Pages Worker does not export a fetch handler.");
	}
	const environment = {
		ASSETS: {
			async fetch(request) {
				const pathname = new URL(request.url).pathname;
				if (pathname === "/index.html") return new Response(template);
				return new Response("asset-not-found", { status: 404 });
			},
		},
	};
	const cases = [
		{ path: "/evidence", status: 200, mode: "ssr" },
		{ path: "/profile/", status: 200, mode: "ssr", cache: "private, no-store" },
		{ path: "/missing", status: 404, mode: "ssr" },
		{ path: "/api", status: 404, mode: null },
	];
	for (const scenario of cases) {
		const response = await worker.fetch(
			new Request(`https://runtime.test${scenario.path}`, {
				headers: { accept: "text/html" },
			}),
			environment,
		);
		if (response.status !== scenario.status) {
			throw new Error(
				`Built Worker ${scenario.path} returned ${response.status}; expected ${scenario.status}.`,
			);
		}
		if (response.headers.get("x-babysteps-render-mode") !== scenario.mode) {
			throw new Error(
				`Built Worker ${scenario.path} returned the wrong render mode.`,
			);
		}
		if (
			scenario.cache &&
			response.headers.get("cache-control") !== scenario.cache
		) {
			throw new Error(
				`Built Worker ${scenario.path} returned the wrong cache policy.`,
			);
		}
		if (scenario.mode === "ssr") {
			const body = await response.text();
			if (!body.includes('data-render-mode="ssr"')) {
				throw new Error(
					`Built Worker ${scenario.path} did not return an SSR document.`,
				);
			}
		}
	}
	return { cases: cases.length };
}

const isCli =
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCli) {
	const workerPath = resolve(process.argv[2] ?? "web/dist/_worker.js");
	const result = await validateBuiltRenderingRuntime(workerPath);
	console.log(
		`Built Worker runtime matrix passed: ${result.cases} request scenarios.`,
	);
}
