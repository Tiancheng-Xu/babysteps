import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { zeroAddress } from "viem";

describe("OnchainNotebook", async () => {
	const { viem, networkHelpers } = await network.create();
	const [author, reader] = await viem.getWalletClients();

	it("starts empty and isolates notes by wallet", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		assert.equal(await notebook.read.getNote([author.account.address]), "");
		await notebook.write.setNote(["author note"], { account: author.account });
		assert.equal(await notebook.read.getNote([reader.account.address]), "");
	});

	it("writes and replaces the author's note", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await notebook.write.setNote(["first note"], { account: author.account });
		await notebook.write.setNote(["replacement note"], {
			account: author.account,
		});

		assert.equal(
			await notebook.read.getNote([author.account.address]),
			"replacement note",
		);
	});

	it("clears only the caller's note", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await notebook.write.setNote(["author note"], { account: author.account });
		await notebook.write.setNote(["reader note"], { account: reader.account });
		await notebook.write.clearNote([], { account: author.account });

		assert.equal(await notebook.read.getNote([author.account.address]), "");
		assert.equal(
			await notebook.read.getNote([reader.account.address]),
			"reader note",
		);
	});

	it("emits NoteUpdated with the author and note", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await viem.assertions.emitWithArgs(
			notebook.write.setNote(["event note"], { account: author.account }),
			notebook,
			"NoteUpdated",
			[author.account.address, "event note"],
		);
	});

	it("emits NoteCleared with the author", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await viem.assertions.emitWithArgs(
			notebook.write.clearNote([], { account: author.account }),
			notebook,
			"NoteCleared",
			[author.account.address],
		);
	});

	it("accepts a note of 280 ASCII bytes", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		const note = "a".repeat(280);

		await notebook.write.setNote([note], { account: author.account });

		assert.equal(await notebook.read.getNote([author.account.address]), note);
	});

	it("rejects a note of 281 ASCII bytes with its byte length", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.setNote(["a".repeat(281)], { account: author.account }),
			notebook,
			"NoteTooLong",
			[281n, 280n],
		);
	});

	it("accepts 70 four-byte emoji", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		const note = "😀".repeat(70);

		await notebook.write.setNote([note], { account: author.account });

		assert.equal(await notebook.read.getNote([author.account.address]), note);
	});

	it("rejects 71 four-byte emoji", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.setNote(["😀".repeat(71)], { account: author.account }),
			notebook,
			"NoteTooLong",
			[284n, 280n],
		);
	});

	it("awards Meal, Walk, and Read as 3, 5, and 7 points", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");

		await notebook.write.recordActivity([0], { account: author.account });
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			3n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			1,
		);

		await notebook.write.recordActivity([1], { account: author.account });
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			8n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			2,
		);

		await notebook.write.recordActivity([2], { account: author.account });
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			15n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			3,
		);
		assert.equal(
			await notebook.read.getTransferableBalance([author.account.address]),
			15n,
		);
	});

	it("keeps lifetime growth unchanged when points are transferred", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([2], { account: author.account });
		await notebook.write.transferGrowthPoints([reader.account.address, 5n], {
			account: author.account,
		});

		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			7n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			1,
		);
		assert.equal(
			await notebook.read.getGrowthPoints([reader.account.address]),
			0n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([reader.account.address]),
			0,
		);
		assert.equal(
			await notebook.read.getTransferableBalance([author.account.address]),
			2n,
		);
		assert.equal(
			await notebook.read.getTransferableBalance([reader.account.address]),
			5n,
		);
	});

	it("emits a point transfer with both final balances", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });

		await viem.assertions.emitWithArgs(
			notebook.write.transferGrowthPoints([reader.account.address, 2n], {
				account: author.account,
			}),
			notebook,
			"GrowthPointsTransferred",
			[author.account.address, reader.account.address, 2n, 1n, 2n],
		);
	});

	it("allows a recipient to gift received points again", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });
		await notebook.write.transferGrowthPoints([reader.account.address, 2n], {
			account: author.account,
		});
		await notebook.write.transferGrowthPoints([author.account.address, 1n], {
			account: reader.account,
		});

		assert.equal(
			await notebook.read.getTransferableBalance([author.account.address]),
			2n,
		);
		assert.equal(
			await notebook.read.getTransferableBalance([reader.account.address]),
			1n,
		);
	});

	it("rejects invalid recipients without changing the balance", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });

		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.transferGrowthPoints([zeroAddress, 1n], {
				account: author.account,
			}),
			notebook,
			"InvalidTransferRecipient",
			[zeroAddress],
		);
		await viem.assertions.revertWithCustomError(
			notebook.write.transferGrowthPoints([author.account.address, 1n], {
				account: author.account,
			}),
			notebook,
			"CannotTransferToSelf",
		);
		assert.equal(
			await notebook.read.getTransferableBalance([author.account.address]),
			3n,
		);
	});

	it("rejects invalid or unavailable amounts without changing balances", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });

		await viem.assertions.revertWithCustomError(
			notebook.write.transferGrowthPoints([reader.account.address, 0n], {
				account: author.account,
			}),
			notebook,
			"InvalidTransferAmount",
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.transferGrowthPoints([reader.account.address, 4n], {
				account: author.account,
			}),
			notebook,
			"InsufficientTransferableBalance",
			[3n, 4n],
		);
		assert.equal(
			await notebook.read.getTransferableBalance([author.account.address]),
			3n,
		);
		assert.equal(
			await notebook.read.getTransferableBalance([reader.account.address]),
			0n,
		);
	});

	it("rejects a repeated activity without changing points or today's marker", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });
		const dayId = await notebook.read.currentUtc8DayId();

		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.recordActivity([0], { account: author.account }),
			notebook,
			"ActivityAlreadyRecordedToday",
			[author.account.address, 0, dayId],
		);

		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			3n,
		);
		assert.equal(
			await notebook.read.hasRecordedToday([author.account.address, 0]),
			true,
		);
	});

	it("isolates daily activity state and points by wallet", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([0], { account: author.account });

		assert.equal(
			await notebook.read.hasRecordedToday([reader.account.address, 0]),
			false,
		);

		await notebook.write.recordActivity([0], { account: reader.account });

		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			3n,
		);
		assert.equal(
			await notebook.read.getGrowthPoints([reader.account.address]),
			3n,
		);
	});

	it("emits the activity, Beijing day, reward, total, and stage", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		const dayId = await notebook.read.currentUtc8DayId();

		await viem.assertions.emitWithArgs(
			notebook.write.recordActivity([1], { account: author.account }),
			notebook,
			"ActivityRecorded",
			[author.account.address, 1, dayId, 5n, 5n, 1],
		);
	});

	it("resets a daily activity exactly at Beijing midnight", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		const day = 24 * 60 * 60;
		const offset = 8 * 60 * 60;
		const latest = Number(await networkHelpers.time.latest());
		const atBeijingMidnight =
			(Math.floor((latest + offset) / day) + 1) * day - offset;

		await networkHelpers.time.setNextBlockTimestamp(atBeijingMidnight - 1);
		await notebook.write.recordActivity([0], { account: author.account });
		assert.equal(
			await notebook.read.hasRecordedToday([author.account.address, 0]),
			true,
		);

		await networkHelpers.time.setNextBlockTimestamp(atBeijingMidnight);
		await notebook.write.recordActivity([0], { account: author.account });
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			6n,
		);
	});

	it("does not reset at UTC midnight when Beijing stays on the same day", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		const day = 24 * 60 * 60;
		const latest = Number(await networkHelpers.time.latest());
		const atUtcMidnight = (Math.floor(latest / day) + 1) * day;

		await networkHelpers.time.setNextBlockTimestamp(atUtcMidnight - 1);
		await notebook.write.recordActivity([0], { account: author.account });
		await networkHelpers.time.setNextBlockTimestamp(atUtcMidnight);

		const dayId = await notebook.read.currentUtc8DayId();
		await viem.assertions.revertWithCustomErrorWithArgs(
			notebook.write.recordActivity([0], { account: author.account }),
			notebook,
			"ActivityAlreadyRecordedToday",
			[author.account.address, 0, dayId],
		);
	});

	it("keeps 14 points in Explorer and unlocks Star at 15", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.recordActivity([2], { account: author.account });

		const day = 24 * 60 * 60;
		const offset = 8 * 60 * 60;
		const latest = Number(await networkHelpers.time.latest());
		const nextBeijingDay =
			(Math.floor((latest + offset) / day) + 1) * day - offset;
		await networkHelpers.time.setNextBlockTimestamp(nextBeijingDay);
		await notebook.write.recordActivity([2], { account: author.account });

		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			14n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			2,
		);

		await notebook.write.recordActivity([0], { account: author.account });
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			17n,
		);
		assert.equal(
			await notebook.read.getGrowthStage([author.account.address]),
			3,
		);
	});

	it("keeps notebook and growth state independent", async () => {
		const notebook = await viem.deployContract("OnchainNotebook");
		await notebook.write.setNote(["public test note"], {
			account: author.account,
		});
		await notebook.write.recordActivity([0], { account: author.account });

		assert.equal(
			await notebook.read.getNote([author.account.address]),
			"public test note",
		);
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			3n,
		);

		await notebook.write.clearNote([], { account: author.account });

		assert.equal(await notebook.read.getNote([author.account.address]), "");
		assert.equal(
			await notebook.read.getGrowthPoints([author.account.address]),
			3n,
		);
		assert.equal(
			await notebook.read.hasRecordedToday([author.account.address, 0]),
			true,
		);
	});
});
