import type { ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import type { PerformanceEventInput } from "./performance/types";
import { parseRenderState, type RenderState } from "./ssr/renderState";

export type ClientRootController = {
	render(node: ReactNode): void;
	unmount(): void;
};

type HydrateOptions = {
	onRecoverableError(error: unknown): void;
	onUncaughtError(error: unknown): void;
};

type BootstrapOptions = {
	root: HTMLElement;
	state?: RenderState;
	currentPathname?: string;
	buildVersion?: string;
	buildApplication(interactive: boolean): ReactNode;
	hydrate?: (
		container: HTMLElement,
		application: ReactNode,
		options: HydrateOptions,
	) => ClientRootController;
	create?: (container: HTMLElement) => ClientRootController;
	record(event: PerformanceEventInput): void;
};

export type BootstrapResult = { mode: "hydrate" | "csr" };

export function readRenderStateFromDocument(
	documentRef: Document = document,
): RenderState | undefined {
	return parseRenderState(
		documentRef.getElementById("__BABYSTEPS_RENDER_STATE__")?.textContent ??
			null,
	);
}

export function bootstrapClient(options: BootstrapOptions): BootstrapResult {
	const hydrate =
		options.hydrate ??
		((container, application, hydrateOptions) =>
			hydrateRoot(container, application, hydrateOptions));
	const create = options.create ?? ((container) => createRoot(container));
	let recovered = false;
	let hydratedRoot: ClientRootController | undefined;

	const renderCsr = () => {
		const root = create(options.root);
		root.render(options.buildApplication(true));
	};

	const recoverToCsr = () => {
		if (recovered) return;
		recovered = true;
		queueMicrotask(() => {
			try {
				hydratedRoot?.unmount();
			} finally {
				options.root.replaceChildren();
				options.record({
					type: "custom",
					name: "csr.fallback",
					value: 1,
					unit: "count",
				});
				renderCsr();
			}
		});
	};

	const shouldHydrate =
		options.state?.mode === "ssr" &&
		(options.currentPathname === undefined ||
			options.state.pathname === options.currentPathname) &&
		(options.buildVersion === undefined ||
			options.state.version === options.buildVersion) &&
		options.root.dataset.renderMode === "ssr" &&
		options.root.hasChildNodes();

	if (!shouldHydrate) {
		if (options.state?.mode === "csr-fallback") {
			options.record({
				type: "custom",
				name: "csr.fallback",
				value: 1,
				unit: "count",
			});
		}
		renderCsr();
		return { mode: "csr" };
	}

	try {
		hydratedRoot = hydrate(options.root, options.buildApplication(false), {
			onRecoverableError() {
				options.record({
					type: "custom",
					name: "hydration.recoverable_error",
					value: 1,
					unit: "count",
				});
			},
			onUncaughtError: recoverToCsr,
		});
		return { mode: "hydrate" };
	} catch {
		recoverToCsr();
		return { mode: "csr" };
	}
}
