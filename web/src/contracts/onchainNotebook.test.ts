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

	it("encodes a transfer with only a recipient and integer amount", () => {
		const recipient = "0x2222222222222222222222222222222222222222";
		const data = encodeFunctionData({
			abi: onchainNotebookAbi,
			functionName: "transferGrowthPoints",
			args: [recipient, 2n],
		});

		expect(decodeFunctionData({ abi: onchainNotebookAbi, data })).toEqual({
			functionName: "transferGrowthPoints",
			args: [recipient, 2n],
		});
	});

	it("exposes the balance getter, transfer event, and exact custom errors", () => {
		expect(
			onchainNotebookAbi.find(
				(item) =>
					item.type === "function" && item.name === "getTransferableBalance",
			),
		).toMatchObject({
			inputs: [{ type: "address" }],
			outputs: [{ type: "uint256" }],
		});
		expect(
			onchainNotebookAbi.find(
				(item) =>
					item.type === "event" && item.name === "GrowthPointsTransferred",
			),
		).toMatchObject({
			inputs: [
				{ type: "address" },
				{ type: "address" },
				{ type: "uint256" },
				{ type: "uint256" },
				{ type: "uint256" },
			],
		});

		const errorNames = onchainNotebookAbi
			.filter((item) => item.type === "error")
			.map((item) => item.name);
		expect(errorNames).toEqual(
			expect.arrayContaining([
				"InvalidTransferRecipient",
				"CannotTransferToSelf",
				"InvalidTransferAmount",
				"InsufficientTransferableBalance",
			]),
		);
	});
});
