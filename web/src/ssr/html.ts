import { type RenderState, safeSerializeRenderState } from "./renderState";

const ROOT_MARKER = '<div id="root"></div>';
const encoder = new TextEncoder();

function renderStateScript(state: RenderState): string {
	return `<script id="__BABYSTEPS_RENDER_STATE__" type="application/json">${safeSerializeRenderState(state)}</script>`;
}

function splitTemplate(template: string): [string, string] {
	const first = template.indexOf(ROOT_MARKER);
	if (first < 0 || template.indexOf(ROOT_MARKER, first + 1) >= 0) {
		throw new Error(
			"Built client template must contain exactly one root marker.",
		);
	}
	return [template.slice(0, first), template.slice(first + ROOT_MARKER.length)];
}

function appendRenderState(documentSuffix: string, state: RenderState): string {
	const bodyEnd = documentSuffix.lastIndexOf("</body>");
	if (bodyEnd < 0) throw new Error("Built client template is missing </body>.");
	return `${documentSuffix.slice(0, bodyEnd)}${renderStateScript(state)}${documentSuffix.slice(bodyEnd)}`;
}

export function composeSsrDocument(
	template: string,
	app: ReadableStream<Uint8Array>,
	state: RenderState,
): ReadableStream<Uint8Array> {
	const [prefix, suffix] = splitTemplate(template);
	const reader = app.getReader();
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				controller.enqueue(
					encoder.encode(`${prefix}<div id="root" data-render-mode="ssr">`),
				);
				while (true) {
					const result = await reader.read();
					if (result.done) break;
					controller.enqueue(result.value);
				}
				controller.enqueue(
					encoder.encode(`</div>${appendRenderState(suffix, state)}`),
				);
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

export function buildCsrFallbackDocument(
	template: string,
	state: RenderState,
): string {
	const [prefix, suffix] = splitTemplate(template);
	return `${prefix}<div id="root" data-render-mode="csr-fallback"></div>${appendRenderState(suffix, state)}`;
}
