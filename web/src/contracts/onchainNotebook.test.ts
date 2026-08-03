import { decodeFunctionData, encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import { onchainNotebookAbi } from "./onchainNotebook";

describe("OnchainNotebook frontend ABI", () => {
	it("encodes a typed activity without free text", () => {
		const data = encodeFunctionData({
			abi: onchainNotebookAbi,
			functionName: "recordActivity",
			args: [2],
		});

		expect(decodeFunctionData({ abi: onchainNotebookAbi, data })).toEqual({
			functionName: "recordActivity",
			args: [2],
		});
	});

	it("keeps ActivityRecorded free of string inputs", () => {
		const event = onchainNotebookAbi.find(
			(item) => item.type === "event" && item.name === "ActivityRecorded",
		);

		expect(event).toMatchObject({
			inputs: [
				{ type: "address" },
				{ type: "uint8" },
				{ type: "uint256" },
				{ type: "uint256" },
				{ type: "uint256" },
				{ type: "uint8" },
			],
		});
	});
});
