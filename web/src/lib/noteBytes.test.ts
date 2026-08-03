import { describe, expect, it } from "vitest";

import { getNoteByteLength, isNoteWithinLimit } from "./noteBytes";

describe("note byte boundaries", () => {
	it("counts UTF-8 bytes rather than JavaScript characters", () => {
		expect(getNoteByteLength("a".repeat(280))).toBe(280);
		expect(getNoteByteLength("😀".repeat(70))).toBe(280);
	});

	it("rejects a note one UTF-8 byte over the contract limit", () => {
		expect(isNoteWithinLimit("😀".repeat(71))).toBe(false);
	});
});
