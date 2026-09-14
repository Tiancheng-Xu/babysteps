import { afterEach, describe, expect, it } from "vitest";

import {
	clearGuestJourney,
	type GuestJourney,
	guestTaskFor,
	loadGuestJourney,
	saveGuestJourney,
} from "./guestJourney";

const journey: GuestJourney = {
	version: 1,
	stage: "newborn",
	market: "china",
	city: "ningbo",
	taskId: "newborn-voice",
	status: "completed",
	startedAt: "2026-09-14T14:00:00.000Z",
};

describe("guest journey", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("recommends a three-minute activity by baby stage", () => {
		expect(guestTaskFor("newborn")).toMatchObject({
			id: "newborn-voice",
			durationMinutes: 3,
		});
		expect(guestTaskFor("toddler").id).toBe("toddler-treasure");
	});

	it("stores only the bounded guest trial state", () => {
		saveGuestJourney(journey);

		expect(loadGuestJourney()).toEqual(journey);
		expect(localStorage.getItem("babysteps.guest-journey.v1")).not.toContain(
			"name",
		);
	});

	it("fails closed for invalid persisted data", () => {
		localStorage.setItem(
			"babysteps.guest-journey.v1",
			JSON.stringify({ ...journey, city: "precise-home-address" }),
		);

		expect(loadGuestJourney()).toBeUndefined();
		expect(localStorage.getItem("babysteps.guest-journey.v1")).toBeNull();
	});

	it("rejects a city that does not belong to the selected market", () => {
		localStorage.setItem(
			"babysteps.guest-journey.v1",
			JSON.stringify({ ...journey, market: "japan", city: "ningbo" }),
		);

		expect(loadGuestJourney()).toBeUndefined();
		expect(localStorage.getItem("babysteps.guest-journey.v1")).toBeNull();
	});

	it("can clear the local trial without touching other storage", () => {
		localStorage.setItem("unrelated", "keep");
		saveGuestJourney(journey);
		clearGuestJourney();

		expect(loadGuestJourney()).toBeUndefined();
		expect(localStorage.getItem("unrelated")).toBe("keep");
	});
});
