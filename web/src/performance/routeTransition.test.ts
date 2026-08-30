import { describe, expect, it } from "vitest";

import {
	completeRouteTransition,
	startRouteTransition,
} from "./routeTransition";

describe("SPA route performance", () => {
	it("measures one user-initiated route transition without retaining the URL", () => {
		startRouteTransition(10);
		expect(completeRouteTransition(34)).toBe(24);
		expect(completeRouteTransition(40)).toBeUndefined();
	});

	it("rejects invalid or negative durations", () => {
		startRouteTransition(50);
		expect(completeRouteTransition(40)).toBeUndefined();
	});
});
