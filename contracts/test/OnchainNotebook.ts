import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("OnchainNotebook", async () => {
	const { viem } = await network.create();
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
});
