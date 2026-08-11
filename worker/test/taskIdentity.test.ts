import { keccak256, toBytes } from "viem";
import { describe, expect, it } from "vitest";
import { buildTaskKey, parseTaskKey } from "../src/domain/taskIdentity";
import { canonicalizeTaskMetadata } from "../src/domain/taskMetadata";

const marketplace = "0x1234567890abcdef1234567890abcdef12345678" as const;

const metadata = {
	title: "  Bedtime Story  ",
	description: "  Read one picture book together before sleep.  ",
	coverUrl: "https://cdn.baby2b.online/tasks/read-cover.webp",
	videoUrl: "https://cdn.baby2b.online/tasks/read-guide.mp4",
	completionInstructions: "  Finish the story and confirm completion.  ",
	activityType: "Read" as const,
};

describe("published task identity", () => {
	it("normalizes the address and round-trips the stable key", () => {
		const key = buildTaskKey(
			11155111,
			marketplace.toUpperCase() as `0x${string}`,
			42n,
		);

		expect(key).toBe(`11155111:${marketplace}:42`);
		expect(parseTaskKey(key)).toEqual({
			chainId: 11155111,
			marketplaceAddress: marketplace,
			taskId: 42n,
		});
	});

	it.each([
		[0, marketplace, 1n],
		[11155111, "0xinvalid", 1n],
		[11155111, marketplace, 0n],
	])("rejects an invalid identity", (chainId, address, taskId) => {
		expect(() =>
			buildTaskKey(chainId, address as `0x${string}`, taskId),
		).toThrow("TASK_IDENTITY_INVALID");
	});

	it("rejects malformed stable keys", () => {
		expect(() => parseTaskKey("11155111:0xinvalid:1")).toThrow(
			"TASK_IDENTITY_INVALID",
		);
	});
});

describe("canonical task metadata", () => {
	it("trims allowed fields, preserves fixed order, and hashes deterministically", () => {
		const result = canonicalizeTaskMetadata(metadata);
		const canonicalJson = JSON.stringify({
			title: "Bedtime Story",
			description: "Read one picture book together before sleep.",
			coverUrl: metadata.coverUrl,
			videoUrl: metadata.videoUrl,
			completionInstructions: "Finish the story and confirm completion.",
			activityType: "Read",
		});

		expect(result.canonicalJson).toBe(canonicalJson);
		expect(result.metadataHash).toBe(keccak256(toBytes(canonicalJson)));
		expect(canonicalizeTaskMetadata({ ...metadata }).metadataHash).toBe(
			result.metadataHash,
		);
	});

	it.each([
		[{ ...metadata, childName: "not allowed" }, "unknown field"],
		[{ ...metadata, coverUrl: "http://example.com/cover.png" }, "HTTPS"],
		[{ ...metadata, videoUrl: "javascript:alert(1)" }, "HTTPS"],
		[{ ...metadata, title: "x" }, "title"],
		[{ ...metadata, description: "x" }, "description"],
		[{ ...metadata, completionInstructions: "x" }, "completion"],
		[{ ...metadata, activityType: "Nap" }, "activity"],
	])("rejects unsafe or incomplete metadata: %s", (input, expected) => {
		expect(() => canonicalizeTaskMetadata(input)).toThrow(expected);
	});
});
