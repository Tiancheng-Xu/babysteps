import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildApiEndpoint,
	readSessionCookie,
	toPublicEvidence,
} from "../scripts/lib/publicApiClosedLoop.js";

describe("public Worker API closed-loop helpers", () => {
	it("builds API endpoints without duplicate slashes", () => {
		assert.equal(
			buildApiEndpoint("https://babysteps-api.baby2b.online/", "/api/profile"),
			"https://babysteps-api.baby2b.online/api/profile",
		);
	});

	it("extracts only the session cookie pair", () => {
		assert.equal(
			readSessionCookie(
				"babysteps_session=opaque-value; Path=/; HttpOnly; Secure; SameSite=Lax",
			),
			"babysteps_session=opaque-value",
		);
		assert.throws(() => readSessionCookie(null), /session cookie/u);
	});

	it("keeps verifiable facts and removes authentication material", () => {
		const evidence = toPublicEvidence({
			wallet: "0x0000000000000000000000000000000000000001",
			taskKey: "11155111:0x0000000000000000000000000000000000000002:2",
			draftId: "draft-id",
			commentId: "comment-id",
			username: "StarBuddy Parent",
			transactionHash: `0x${"ab".repeat(32)}`,
			metadataHash: `0x${"cd".repeat(32)}`,
			cookie: "babysteps_session=secret",
			signature: `0x${"ef".repeat(65)}`,
		});

		assert.deepEqual(evidence, {
			wallet: "0x0000000000000000000000000000000000000001",
			taskKey: "11155111:0x0000000000000000000000000000000000000002:2",
			draftId: "draft-id",
			commentId: "comment-id",
			username: "StarBuddy Parent",
			transactionHash: `0x${"ab".repeat(32)}`,
			metadataHash: `0x${"cd".repeat(32)}`,
		});
		assert.doesNotMatch(JSON.stringify(evidence), /cookie|signature|secret/iu);
	});
});
