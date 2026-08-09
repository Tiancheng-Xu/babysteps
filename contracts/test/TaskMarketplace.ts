import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, parseEther, zeroAddress } from "viem";

const zeroKeyHash = `0x${"00".repeat(32)}` as `0x${string}`;

type TaskView = {
	provider: `0x${string}`;
	payee: `0x${string}`;
	activityType: number;
	metadataUri: string;
	requestId: bigint;
	price: bigint;
	opensAt: bigint;
	closesAt: bigint;
	active: boolean;
	paused: boolean;
};

type PurchaseView = {
	buyer: `0x${string}`;
	taskId: bigint;
	price: bigint;
	purchasedAt: bigint;
	completed: boolean;
	certificateTokenId: bigint;
};

describe("TaskMarketplace", async () => {
	const { viem, networkHelpers } = await network.create();
	const [admin, provider, outsider, parent, oracle] =
		await viem.getWalletClients();

	async function deploySystem() {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const certificate = await viem.deployContract("GrowthCertificate", [
			admin.account.address,
		]);
		const coordinator = await viem.deployContract("MockVrfCoordinator");
		const marketplace = await viem.deployContract("TaskMarketplace", [
			admin.account.address,
			token.address,
			certificate.address,
			coordinator.address,
			1n,
			zeroKeyHash,
			3,
			500_000,
		]);
		const providerRole = await marketplace.read.PROVIDER_ROLE();
		await marketplace.write.grantRole(
			[providerRole, provider.account.address],
			{ account: admin.account },
		);
		return { token, certificate, coordinator, marketplace, providerRole };
	}

	it("lets only providers create a pending task backed by one VRF request", async () => {
		const { coordinator, marketplace, providerRole } = await deploySystem();

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.createTask(
				[outsider.account.address, 1, "ipfs://task/walk-denied"],
				{ account: outsider.account },
			),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[outsider.account.address, providerRole],
		);

		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 1, "ipfs://task/walk-1"],
			{ account: provider.account },
		);

		const requestId = await coordinator.read.latestRequestId();
		assert.equal(await coordinator.read.latestNativePayment(), true);
		const task = (await marketplace.read.getTask([taskId])) as TaskView;
		assert.equal(task.provider, getAddress(provider.account.address));
		assert.equal(task.payee, getAddress(provider.account.address));
		assert.equal(task.metadataUri, "ipfs://task/walk-1");
		assert.equal(task.requestId, requestId);
		assert.equal(task.active, false);
		assert.equal(task.price, 0n);
		assert.equal(await marketplace.read.requestToTaskId([requestId]), taskId);
	});

	it("locks price and activity duration from the first VRF fulfillment", async () => {
		const cases = [
			{ activity: 0, priceWord: 0n, durationWord: 0n, price: "2", hours: 3 },
			{ activity: 0, priceWord: 2n, durationWord: 1n, price: "4", hours: 4 },
			{ activity: 1, priceWord: 1n, durationWord: 4n, price: "3", hours: 12 },
			{ activity: 2, priceWord: 0n, durationWord: 2n, price: "2", hours: 6 },
		] as const;

		for (const testCase of cases) {
			const { coordinator, marketplace } = await deploySystem();
			const taskId = await marketplace.read.nextTaskId();
			await marketplace.write.createTask(
				[
					provider.account.address,
					testCase.activity,
					`ipfs://task/${testCase.activity}`,
				],
				{ account: provider.account },
			);
			const requestId = await coordinator.read.latestRequestId();

			await coordinator.write.fulfill([
				requestId,
				[testCase.priceWord, testCase.durationWord],
			]);

			const task = (await marketplace.read.getTask([taskId])) as TaskView;
			assert.equal(task.active, true);
			assert.equal(task.price, parseEther(testCase.price));
			assert.equal(task.closesAt - task.opensAt, BigInt(testCase.hours * 3600));
		}
	});

	it("rejects duplicate fulfillment and fulfillment from a non-coordinator", async () => {
		const { coordinator, marketplace } = await deploySystem();
		await marketplace.write.createTask(
			[provider.account.address, 2, "ipfs://task/read-1"],
			{ account: provider.account },
		);
		const requestId = await coordinator.read.latestRequestId();
		await coordinator.write.fulfill([requestId, [0n, 0n]]);

		await viem.assertions.revertWithCustomErrorWithArgs(
			coordinator.write.fulfill([requestId, [1n, 1n]]),
			marketplace,
			"TaskAlreadyActivated",
			[1n],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.rawFulfillRandomWords([requestId, [1n, 1n]], {
				account: outsider.account,
			}),
			marketplace,
			"OnlyCoordinatorCanFulfill",
			[outsider.account.address, coordinator.address],
		);
	});

	it("lets only the admin pause an existing task", async () => {
		const { marketplace } = await deploySystem();
		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 0, "ipfs://task/meal-1"],
			{ account: provider.account },
		);

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.setTaskPaused([taskId, true], {
				account: provider.account,
			}),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[provider.account.address, await marketplace.read.DEFAULT_ADMIN_ROLE()],
		);

		await marketplace.write.setTaskPaused([taskId, true], {
			account: admin.account,
		});
		assert.equal(
			((await marketplace.read.getTask([taskId])) as TaskView).paused,
			true,
		);
	});

	it("rejects invalid task recipients and unknown task IDs", async () => {
		const { marketplace } = await deploySystem();
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.createTask([zeroAddress, 0, "ipfs://task/meal-1"], {
				account: provider.account,
			}),
			marketplace,
			"InvalidPayee",
			[zeroAddress],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.read.getTask([999n]),
			marketplace,
			"UnknownTask",
			[999n],
		);
	});

	it("uses approve then buy to pay the provider the exact locked price", async () => {
		const { token, coordinator, marketplace } = await deploySystem();
		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 1, "ipfs://task/walk-buy"],
			{ account: provider.account },
		);
		await coordinator.write.fulfill([
			await coordinator.read.latestRequestId(),
			[1n, 0n],
		]);
		const price = ((await marketplace.read.getTask([taskId])) as TaskView)
			.price;
		await token.write.mintTest([parent.account.address, parseEther("10")], {
			account: admin.account,
		});
		await token.write.approve([marketplace.address, price], {
			account: parent.account,
		});

		const purchaseId = await marketplace.read.nextPurchaseId();
		const parentBalanceBefore = (await token.read.balanceOf([
			parent.account.address,
		])) as bigint;
		const providerBalanceBefore = (await token.read.balanceOf([
			provider.account.address,
		])) as bigint;
		await marketplace.write.buy([taskId], { account: parent.account });

		const purchase = (await marketplace.read.getPurchase([
			purchaseId,
		])) as PurchaseView;
		const parentBalanceAfter = (await token.read.balanceOf([
			parent.account.address,
		])) as bigint;
		const providerBalanceAfter = (await token.read.balanceOf([
			provider.account.address,
		])) as bigint;
		assert.equal(parentBalanceBefore - parentBalanceAfter, price);
		assert.equal(providerBalanceAfter - providerBalanceBefore, price);
		assert.equal(await token.read.lifetimeEarned([parent.account.address]), 0n);
		assert.equal(purchase.buyer, getAddress(parent.account.address));
		assert.equal(purchase.taskId, taskId);
		assert.equal(purchase.price, price);
		assert.equal(purchase.completed, false);
		assert.equal(
			await marketplace.read.hasPurchased([taskId, parent.account.address]),
			true,
		);
	});

	it("rejects missing allowance, missing balance, and a duplicate purchase", async () => {
		const { token, coordinator, marketplace } = await deploySystem();
		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 0, "ipfs://task/meal-buy"],
			{ account: provider.account },
		);
		await coordinator.write.fulfill([
			await coordinator.read.latestRequestId(),
			[0n, 0n],
		]);
		const price = ((await marketplace.read.getTask([taskId])) as TaskView)
			.price;

		await token.write.mintTest([parent.account.address, price], {
			account: admin.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: parent.account }),
			token,
			"ERC20InsufficientAllowance",
			[marketplace.address, 0n, price],
		);

		await token.write.approve([marketplace.address, price], {
			account: parent.account,
		});
		await marketplace.write.buy([taskId], { account: parent.account });
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: parent.account }),
			marketplace,
			"TaskAlreadyPurchased",
			[taskId, parent.account.address],
		);

		await token.write.approve([marketplace.address, price], {
			account: outsider.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: outsider.account }),
			token,
			"ERC20InsufficientBalance",
			[outsider.account.address, 0n, price],
		);
	});

	it("rejects purchases while a task is pending, paused, or expired", async () => {
		const { token, coordinator, marketplace } = await deploySystem();
		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 2, "ipfs://task/read-state"],
			{ account: provider.account },
		);
		await token.write.mintTest([parent.account.address, parseEther("20")], {
			account: admin.account,
		});
		await token.write.approve([marketplace.address, parseEther("20")], {
			account: parent.account,
		});

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: parent.account }),
			marketplace,
			"TaskNotActive",
			[taskId],
		);

		await coordinator.write.fulfill([
			await coordinator.read.latestRequestId(),
			[0n, 0n],
		]);
		await marketplace.write.setTaskPaused([taskId, true], {
			account: admin.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: parent.account }),
			marketplace,
			"TaskIsPaused",
			[taskId],
		);

		await marketplace.write.setTaskPaused([taskId, false], {
			account: admin.account,
		});
		const closesAt = ((await marketplace.read.getTask([taskId])) as TaskView)
			.closesAt;
		await networkHelpers.time.setNextBlockTimestamp(Number(closesAt));
		await networkHelpers.mine();
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.buy([taskId], { account: parent.account }),
			marketplace,
			"TaskExpired",
			[taskId, closesAt],
		);
	});

	it("lets only the oracle complete a purchase and mint one certificate", async () => {
		const { token, certificate, coordinator, marketplace } =
			await deploySystem();
		await marketplace.write.grantRole(
			[await marketplace.read.ORACLE_ROLE(), oracle.account.address],
			{ account: admin.account },
		);
		await certificate.write.grantRole(
			[await certificate.read.MINTER_ROLE(), marketplace.address],
			{ account: admin.account },
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.confirmCompletion(
				[999n, "ipfs://certificate/unknown"],
				{ account: oracle.account },
			),
			marketplace,
			"UnknownPurchase",
			[999n],
		);
		const taskId = await marketplace.read.nextTaskId();
		await marketplace.write.createTask(
			[provider.account.address, 1, "ipfs://task/walk-complete"],
			{ account: provider.account },
		);
		await coordinator.write.fulfill([
			await coordinator.read.latestRequestId(),
			[0n, 0n],
		]);
		const price = ((await marketplace.read.getTask([taskId])) as TaskView)
			.price;
		await token.write.mintTest([parent.account.address, price], {
			account: admin.account,
		});
		await token.write.approve([marketplace.address, price], {
			account: parent.account,
		});
		const purchaseId = await marketplace.read.nextPurchaseId();
		await marketplace.write.buy([taskId], { account: parent.account });

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.confirmCompletion(
				[purchaseId, "ipfs://certificate/walk-complete"],
				{ account: outsider.account },
			),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[outsider.account.address, await marketplace.read.ORACLE_ROLE()],
		);

		await marketplace.write.confirmCompletion(
			[purchaseId, "ipfs://certificate/walk-complete"],
			{ account: oracle.account },
		);
		const purchase = (await marketplace.read.getPurchase([
			purchaseId,
		])) as PurchaseView;
		assert.equal(purchase.completed, true);
		assert.equal(purchase.certificateTokenId, 1n);
		assert.equal(
			await certificate.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);
		assert.equal(await certificate.read.tokenForPurchase([purchaseId]), 1n);

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.confirmCompletion(
				[purchaseId, "ipfs://certificate/walk-complete-again"],
				{ account: oracle.account },
			),
			marketplace,
			"PurchaseAlreadyCompleted",
			[purchaseId],
		);
	});
});
