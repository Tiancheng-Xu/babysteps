import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("BabyCoin", async () => {
	const { viem } = await network.create();
	const [admin, rewarder, parent, recipient] = await viem.getWalletClients();

	it("mints test funds without increasing lifetime earned", async () => {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);

		assert.equal(await token.read.name(), "BabyCoin");
		assert.equal(await token.read.symbol(), "BABY");

		await token.write.mintTest([parent.account.address, parseEther("10")], {
			account: admin.account,
		});

		assert.equal(
			await token.read.balanceOf([parent.account.address]),
			parseEther("10"),
		);
		assert.equal(await token.read.lifetimeEarned([parent.account.address]), 0n);
		assert.equal(await token.read.growthStageOf([parent.account.address]), 0);
	});

	it("counts only reward-role minting toward growth stages", async () => {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const rewardRole = await token.read.REWARD_ROLE();
		await token.write.grantRole([rewardRole, rewarder.account.address], {
			account: admin.account,
		});

		await token.write.reward([parent.account.address, parseEther("3")], {
			account: rewarder.account,
		});
		assert.equal(
			await token.read.lifetimeEarned([parent.account.address]),
			parseEther("3"),
		);
		assert.equal(await token.read.growthStageOf([parent.account.address]), 1);

		await token.write.reward([parent.account.address, parseEther("5")], {
			account: rewarder.account,
		});
		assert.equal(await token.read.growthStageOf([parent.account.address]), 2);

		await token.write.reward([parent.account.address, parseEther("7")], {
			account: rewarder.account,
		});
		assert.equal(await token.read.growthStageOf([parent.account.address]), 3);
	});

	it("rejects unprivileged test and reward minting", async () => {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const adminRole = await token.read.DEFAULT_ADMIN_ROLE();
		const rewardRole = await token.read.REWARD_ROLE();

		await viem.assertions.revertWithCustomErrorWithArgs(
			token.write.mintTest([parent.account.address, 1n], {
				account: parent.account,
			}),
			token,
			"AccessControlUnauthorizedAccount",
			[parent.account.address, adminRole],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			token.write.reward([parent.account.address, 1n], {
				account: parent.account,
			}),
			token,
			"AccessControlUnauthorizedAccount",
			[parent.account.address, rewardRole],
		);
	});

	it("keeps lifetime earned unchanged across transfers", async () => {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const rewardRole = await token.read.REWARD_ROLE();
		await token.write.grantRole([rewardRole, rewarder.account.address], {
			account: admin.account,
		});
		await token.write.reward([parent.account.address, parseEther("7")], {
			account: rewarder.account,
		});

		await token.write.transfer([recipient.account.address, parseEther("5")], {
			account: parent.account,
		});

		assert.equal(
			await token.read.lifetimeEarned([parent.account.address]),
			parseEther("7"),
		);
		assert.equal(
			await token.read.lifetimeEarned([recipient.account.address]),
			0n,
		);
		assert.equal(await token.read.growthStageOf([parent.account.address]), 1);
		assert.equal(
			await token.read.growthStageOf([recipient.account.address]),
			0,
		);
	});
});
