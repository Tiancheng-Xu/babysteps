import { describe, expect, it } from "vitest";

import { resolveActivityVisualState } from "./activityVisualState";

const available = { available: true, dailyLimitReached: false };
const cooldown = { available: false, dailyLimitReached: false };
const dailyLimit = { available: false, dailyLimitReached: true };

describe("activity visual state", () => {
	it.each([
		["meal", "星宝现在还不饿"],
		["walk", "星宝正在休息"],
		["read", "星宝还在回味故事"],
	] as const)("hides the %s button during cooldown", (activityId, copy) => {
		expect(
			resolveActivityVisualState({
				activityId,
				availability: cooldown,
				isActive: false,
				phase: "idle",
				walletReady: true,
			}),
		).toEqual({
			state: "cooldown",
			statusMessage: copy,
			showButton: false,
			buttonDisabled: false,
		});
	});

	it("gives the daily limit priority over cooldown", () => {
		expect(
			resolveActivityVisualState({
				activityId: "meal",
				availability: dailyLimit,
				isActive: false,
				phase: "idle",
				walletReady: true,
			}),
		).toMatchObject({
			state: "daily-limit",
			statusMessage: "星宝今天已经很充实了",
			showButton: false,
		});
	});

	it("shows an enabled button only when the chain says available", () => {
		expect(
			resolveActivityVisualState({
				activityId: "walk",
				availability: available,
				isActive: false,
				phase: "idle",
				walletReady: true,
			}),
		).toMatchObject({
			state: "available",
			showButton: true,
			buttonDisabled: false,
		});
	});

	it.each([
		["awaiting-signature", "awaiting-signature"],
		["confirming", "confirming"],
	] as const)(
		"keeps the active %s button visible but disabled",
		(phase, state) => {
			expect(
				resolveActivityVisualState({
					activityId: "read",
					availability: available,
					isActive: true,
					phase,
					walletReady: true,
				}),
			).toMatchObject({
				state,
				showButton: true,
				buttonDisabled: true,
			});
		},
	);

	it("keeps a non-active available card out of the active transaction state", () => {
		expect(
			resolveActivityVisualState({
				activityId: "walk",
				availability: available,
				isActive: false,
				phase: "confirming",
				walletReady: true,
			}),
		).toMatchObject({
			state: "available",
			showButton: true,
			buttonDisabled: true,
		});
	});

	it.each([
		["success", false],
		["rejected", true],
		["write-error", true],
	] as const)("maps the active %s result", (phase, showButton) => {
		expect(
			resolveActivityVisualState({
				activityId: "meal",
				availability: available,
				isActive: true,
				message: `state ${phase}`,
				phase,
				walletReady: true,
			}),
		).toMatchObject({
			state: phase,
			statusMessage: `state ${phase}`,
			showButton,
			buttonDisabled: false,
		});
	});

	it.each([
		["reading", "loading"],
		["read-error", "read-error"],
	] as const)("hides actions in the %s state", (phase, state) => {
		expect(
			resolveActivityVisualState({
				activityId: "meal",
				availability: undefined,
				isActive: false,
				phase,
				walletReady: true,
			}),
		).toMatchObject({ state, showButton: false });
	});

	it("does not reuse availability before the wallet is ready", () => {
		expect(
			resolveActivityVisualState({
				activityId: "meal",
				availability: available,
				isActive: false,
				phase: "idle",
				walletReady: false,
			}),
		).toMatchObject({ state: "loading", showButton: false });
	});
});
