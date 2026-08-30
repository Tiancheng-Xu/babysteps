import type { PerformanceCategory, PerformanceEventInput } from "./types";

const resourceCategories: Record<string, PerformanceCategory> = {
	fetch: "fetch",
	xhr: "xhr",
	xmlhttprequest: "xhr",
	script: "script",
	link: "stylesheet",
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
	const initiatorType = entry.initiatorType.toLowerCase();
	let category = resourceCategories[initiatorType];
	if (!category || initiatorType === "css") {
		const pathname = new URL(entry.name, origin).pathname.toLowerCase();
		if (/\.(?:woff2?|ttf|otf|eot)$/u.test(pathname)) category = "font";
		else if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/u.test(pathname)) {
			category = "image";
		}
	}
	return {
		type: "resource",
		name: category ? `resource.${category}.duration` : "resource.duration",
		value: entry.duration,
		unit: "ms",
		...(category ? { category } : {}),
	};
}
