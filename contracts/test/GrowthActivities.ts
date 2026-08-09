import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

const policies = [
	{ activity: 0, reward: "3", minimum: 3 * 3600, maximum: 4 * 3600, cap: 6 },
	{ activity: 1, reward: "5", minimum: 8 * 3600, maximum: 12 * 3600, cap: 2 },
	{ activity: 2, reward: "7", minimum: 4 * 3600, maximum: 6 * 3600, cap: 3 },
] as const;

describe("GrowthActivities", async () => {
	const { viem, networkHelpers } = await network.create();
	const [admin, parent, recipient] = await viem.getWalletClients();

	async function deploySystem() {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const activities = await viem.deployContract("GrowthActivities", [
			token.address,
		]);
		await token.write.grantRole(
			[await token.read.REWARD_ROLE(), activities.address],
			{ account: admin.account },
		);
		return { token, activities };
	}

	it("awards the configured BABY amount for every activity", async () => {
		for (const policy of policies) {
			const { token, activities } = await deploySystem();

			await activities.write.recordActivity([policy.activity], {
				account: parent.account,
			});

			assert.equal(
				await token.read.balanceOf([parent.account.address]),
				parseEther(policy.reward),
			);
			assert.equal(
				await token.read.lifetimeEarned([parent.account.address]),
				parseEther(policy.reward),
			);
		}
	});

	it("keeps every activity unavailable through its minimum cooldown and ready by its maximum", async () => {
		for (const policy of policies) {
			const { activities } = await deploySystem();
			await activities.write.recordActivity([policy.activity], {
				account: parent.account,
			});
			const recordedAt = Number(await networkHelpers.time.latest());

			await networkHelpers.time.setNextBlockTimestamp(
				recordedAt + policy.minimum - 1,
			);
			await networkHelpers.mine();
			assert.deepEqual(
				await activities.read.getActivityAvailability([
					parent.account.address,
					policy.activity,
				]),
				[false, false],
			);

			await networkHelpers.time.setNextBlockTimestamp(
				recordedAt + policy.maximum,
			);
			await networkHelpers.mine();
			assert.deepEqual(
				await activities.read.getActivityAvailability([
					parent.account.address,
					policy.activity,
				]),
				[true, false],
			);
		}
	});

	it("enforces every UTC+8 daily activity cap", async () => {
		for (const policy of policies) {
			const { activities } = await deploySystem();
			const now = Number(await networkHelpers.time.latest());
			const nextUtc8Day = Math.floor((now + 8 * 3600) / 86400) + 1;
			let timestamp = nextUtc8Day * 86400 - 8 * 3600 + 60;
			await networkHelpers.time.setNextBlockTimestamp(timestamp);

			for (let claim = 0; claim < policy.cap; claim += 1) {
				await activities.write.recordActivity([policy.activity], {
					account: parent.account,
				});
				if (claim < policy.cap - 1) {
					timestamp += policy.maximum;
					await networkHelpers.time.setNextBlockTimestamp(timestamp);
				}
			}

			const dayId = await activities.read.currentUtc8DayId();
			await viem.assertions.revertWithCustomErrorWithArgs(
				activities.write.recordActivity([policy.activity], {
					account: parent.account,
				}),
				activities,
				"DailyActivityLimitReached",
				[parent.account.address, policy.activity, dayId],
			);
			assert.deepEqual(
				await activities.read.getActivityAvailability([
					parent.account.address,
					policy.activity,
				]),
				[false, true],
			);
		}
	});

	it("does not turn transferred BABY into the recipient's growth", async () => {
		const { token, activities } = await deploySystem();
		await activities.write.recordActivity([2], { account: parent.account });

		await token.write.transfer([recipient.account.address, parseEther("5")], {
			account: parent.account,
		});

		assert.equal(
			await token.read.lifetimeEarned([recipient.account.address]),
			0n,
		);
		assert.equal(
			await token.read.growthStageOf([recipient.account.address]),
			0,
		);
	});
});
