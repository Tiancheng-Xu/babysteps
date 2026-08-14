import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { bootstrapClient, type ClientRootController } from "./bootstrap";

function controller(): ClientRootController {
	return { render: vi.fn(), unmount: vi.fn() };
}

describe("BabySteps client bootstrap", () => {
	it("hydrates matching SSR markup", () => {
		const root = document.createElement("div");
		root.dataset.renderMode = "ssr";
		root.innerHTML = "<h1>SSR</h1>";
		const hydrated = controller();
		const hydrate = vi.fn(() => hydrated);
		const create = vi.fn(() => controller());

		const result = bootstrapClient({
			root,
			state: { mode: "ssr", pathname: "/", version: "v1" },
			currentPathname: "/",
			buildVersion: "v1",
			buildApplication: () => "app" as ReactNode,
			hydrate,
			create,
			record: vi.fn(),
		});

		expect(result.mode).toBe("hydrate");
		expect(hydrate).toHaveBeenCalledOnce();
		expect(create).not.toHaveBeenCalled();
	});

	it("rejects stale SSR state from a different path or build", () => {
		for (const state of [
			{ mode: "ssr" as const, pathname: "/tasks", version: "v1" },
			{ mode: "ssr" as const, pathname: "/", version: "old" },
		]) {
			const root = document.createElement("div");
			root.dataset.renderMode = "ssr";
			root.innerHTML = "<h1>stale</h1>";
			const hydrate = vi.fn(() => controller());
			const create = vi.fn(() => controller());

			const result = bootstrapClient({
				root,
				state,
				currentPathname: "/",
				buildVersion: "v1",
				buildApplication: () => "app" as ReactNode,
				hydrate,
				create,
				record: vi.fn(),
			});

			expect(result.mode).toBe("csr");
			expect(hydrate).not.toHaveBeenCalled();
			expect(create).toHaveBeenCalledOnce();
		}
	});

	it("uses pure CSR for the static fallback shell", () => {
		const root = document.createElement("div");
		const created = controller();
		const create = vi.fn(() => created);

		const result = bootstrapClient({
			root,
			state: { mode: "csr-fallback", pathname: "/profile", version: "v1" },
			buildApplication: () => "app" as ReactNode,
			hydrate: vi.fn(() => controller()),
			create,
			record: vi.fn(),
		});

		expect(result.mode).toBe("csr");
		expect(create).toHaveBeenCalledOnce();
		expect(created.render).toHaveBeenCalledOnce();
	});

	it("reports recoverable hydration mismatches without remounting", () => {
		const root = document.createElement("div");
		root.dataset.renderMode = "ssr";
		root.innerHTML = "<h1>SSR</h1>";
		const record = vi.fn();
		const create = vi.fn(() => controller());
		const hydrate = vi.fn((_root, _app, options) => {
			options.onRecoverableError(new Error("mismatch"));
			return controller();
		});

		bootstrapClient({
			root,
			state: { mode: "ssr", pathname: "/", version: "v1" },
			buildApplication: () => "app" as ReactNode,
			hydrate,
			create,
			record,
		});

		expect(record).toHaveBeenCalledWith(
			expect.objectContaining({ name: "hydration.recoverable_error" }),
		);
		expect(create).not.toHaveBeenCalled();
	});

	it("falls back to CSR at most once after a fatal hydration error", async () => {
		const root = document.createElement("div");
		root.dataset.renderMode = "ssr";
		root.innerHTML = "<h1>SSR</h1>";
		const hydrated = controller();
		const created = controller();
		const create = vi.fn(() => created);
		let fatal: ((error: unknown) => void) | undefined;
		const hydrate = vi.fn((_root, _app, options) => {
			fatal = options.onUncaughtError;
			return hydrated;
		});

		bootstrapClient({
			root,
			state: { mode: "ssr", pathname: "/", version: "v1" },
			buildApplication: () => "app" as ReactNode,
			hydrate,
			create,
			record: vi.fn(),
		});
		fatal?.(new Error("fatal"));
		fatal?.(new Error("second fatal"));
		await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

		expect(hydrated.unmount).toHaveBeenCalledOnce();
		expect(create).toHaveBeenCalledOnce();
		expect(created.render).toHaveBeenCalledOnce();
	});
});
