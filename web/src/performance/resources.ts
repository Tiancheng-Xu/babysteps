import type { PerformanceCategory, PerformanceEventInput } from "./types";

const resourceCategories: Record<string, PerformanceCategory> = {
	fetch: "fetch",
	xhr: "xhr",
	xmlhttprequest: "xhr",
	script: "script",
	link: "stylesheet",
	css: "stylesheet",
	img: "image",
	image: "image",
	font: "font",
};

export function classifyResource(
	entry: Pick<PerformanceResourceTiming, "initiatorType" | "duration" | "name">,
	origin: string,
): PerformanceEventInput | undefined {
	let resourceOrigin: string;
	try {
		resourceOrigin = new URL(entry.name, origin).origin;
	} catch {
		return undefined;
	}
	if (resourceOrigin !== origin || !Number.isFinite(entry.duration))
		return undefined;
	const category = resourceCategories[entry.initiatorType.toLowerCase()];
	return {
		type: "resource",
		name: category ? `resource.${category}.duration` : "resource.duration",
		value: entry.duration,
		unit: "ms",
		...(category ? { category } : {}),
	};
}
