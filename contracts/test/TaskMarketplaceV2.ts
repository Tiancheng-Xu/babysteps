import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import {
	getAddress,
	keccak256,
	parseEther,
	toBytes,
	zeroAddress,
	zeroHash,
} from "viem";

const zeroKeyHash = `0x${"00".repeat(32)}` as `0x${string}`;

type TaskView = {
	provider: `0x${string}`;
	payee: `0x${string}`;
	activityType: number;
	metadataUri: string;
	metadataHash: `0x${string}`;
	rejectionReasonHash: `0x${string}`;
	requestId: bigint;
	price: bigint;
	opensAt: bigint;
	closesAt: bigint;
	status: number;
	paused: boolean;
};

type PurchaseView = {
	buyer: `0x${string}`;
	taskId: bigint;
	price: bigint;
	purchasedAt: bigint;
	completed: boolean;
	evidenceHash: `0x${string}`;
	certificateTokenId: bigint;
};

describe("TaskMarketplaceV2 review and randomness", async () => {
	const { viem, networkHelpers } = await network.create();
	const [admin, provider, outsider, parent, relayer] =
		await viem.getWalletClients();

	async function deploySystem() {
		const token = await viem.deployContract("BabyCoin", [
			admin.account.address,
		]);
		const certificate = await viem.deployContract("GrowthCertificateSBT", [
			admin.account.address,
		]);
		const coordinator = await viem.deployContract("MockVrfCoordinator");
		const marketplace = await viem.deployContract("TaskMarketplaceV2", [
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
		const minterRole = await certificate.read.MINTER_ROLE();
		await certificate.write.grantRole([minterRole, marketplace.address], {
			account: admin.account,
		});
		return { token, certificate, coordinator, marketplace, providerRole };
	}

	async function requestTask(
		marketplace: Awaited<ReturnType<typeof deploySystem>>["marketplace"],
		activityType = 1,
	) {
		const taskId = await marketplace.read.nextTaskId();
		const metadataHash = keccak256(toBytes(`walk-${taskId}`));
		await marketplace.write.requestTask(
			[
				provider.account.address,
				activityType,
				`ipfs://task/${taskId}`,
				metadataHash,
			],
			{ account: provider.account },
		);
		return { taskId, metadataHash };
	}

	async function activateTask(
		system: Awaited<ReturnType<typeof deploySystem>>,
		priceWord = 1n,
	) {
		const { taskId } = await requestTask(system.marketplace);
		await system.marketplace.write.approveTask([taskId], {
			account: admin.account,
		});
		await system.coordinator.write.fulfill([
			await system.coordinator.read.latestRequestId(),
			[priceWord, 0n],
		]);
		return taskId;
	}

	it("stores a Provider submission for review without spending a VRF request", async () => {
		const { coordinator, marketplace } = await deploySystem();
		const { taskId, metadataHash } = await requestTask(marketplace);

		const task = (await marketplace.read.getTask([taskId])) as TaskView;
		assert.equal(task.provider, getAddress(provider.account.address));
		assert.equal(task.payee, getAddress(provider.account.address));
		assert.equal(task.activityType, 1);
		assert.equal(task.metadataUri, `ipfs://task/${taskId}`);
		assert.equal(task.metadataHash, metadataHash);
		assert.equal(task.status, 1);
		assert.equal(task.requestId, 0n);
		assert.equal(await coordinator.read.latestRequestId(), 0n);
	});

	it("rejects unauthorized and malformed submissions", async () => {
		const { marketplace, providerRole } = await deploySystem();
		const validHash = keccak256(toBytes("valid"));

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.requestTask(
				[outsider.account.address, 0, "ipfs://task/outsider", validHash],
				{ account: outsider.account },
			),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[outsider.account.address, providerRole],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.requestTask(
				[zeroAddress, 0, "ipfs://task/meal", validHash],
				{ account: provider.account },
			),
			marketplace,
			"InvalidPayee",
			[zeroAddress],
		);
		await viem.assertions.revertWithCustomError(
			marketplace.write.requestTask(
				[provider.account.address, 0, "", validHash],
				{ account: provider.account },
			),
			marketplace,
			"InvalidMetadataUri",
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.requestTask(
				[provider.account.address, 0, "ipfs://task/meal", zeroHash],
				{ account: provider.account },
			),
			marketplace,
			"InvalidMetadataHash",
			[zeroHash],
		);
	});

	it("lets only Owner approve a pending task and request randomness once", async () => {
		const { coordinator, marketplace } = await deploySystem();
		const { taskId } = await requestTask(marketplace);
		const adminRole = await marketplace.read.DEFAULT_ADMIN_ROLE();

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.approveTask([taskId], { account: provider.account }),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[provider.account.address, adminRole],
		);
		await marketplace.write.approveTask([taskId], { account: admin.account });

		const requestId = await coordinator.read.latestRequestId();
		const task = (await marketplace.read.getTask([taskId])) as TaskView;
		assert.equal(requestId, 1n);
		assert.equal(task.requestId, requestId);
		assert.equal(task.status, 2);
		assert.equal(await marketplace.read.requestToTaskId([requestId]), taskId);

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.approveTask([taskId], { account: admin.account }),
			marketplace,
			"InvalidTaskStatus",
			[taskId, 1, 2],
		);
	});

	it("lets Owner reject a pending task without requesting randomness", async () => {
		const { coordinator, marketplace } = await deploySystem();
		const { taskId } = await requestTask(marketplace);
		const reasonHash = keccak256(toBytes("metadata policy rejected"));

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.rejectTask([taskId, reasonHash], {
				account: provider.account,
			}),
			marketplace,
			"AccessControlUnauthorizedAccount",
			[provider.account.address, await marketplace.read.DEFAULT_ADMIN_ROLE()],
		);
		await marketplace.write.rejectTask([taskId, reasonHash], {
			account: admin.account,
		});

		const task = (await marketplace.read.getTask([taskId])) as TaskView;
		assert.equal(task.status, 4);
		assert.equal(task.rejectionReasonHash, reasonHash);
		assert.equal(task.requestId, 0n);
		assert.equal(await coordinator.read.latestRequestId(), 0n);
		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.approveTask([taskId], { account: admin.account }),
			marketplace,
			"InvalidTaskStatus",
			[taskId, 1, 4],
		);
	});

	it("locks price and duration inside every activity boundary", async () => {
		const cases = [
			{ activity: 0, priceWord: 0n, durationWord: 0n, price: "2", hours: 3 },
			{ activity: 0, priceWord: 2n, durationWord: 1n, price: "4", hours: 4 },
			{ activity: 1, priceWord: 1n, durationWord: 4n, price: "3", hours: 12 },
			{ activity: 2, priceWord: 0n, durationWord: 2n, price: "2", hours: 6 },
		] as const;

		for (const testCase of cases) {
			const { coordinator, marketplace } = await deploySystem();
			const { taskId } = await requestTask(marketplace, testCase.activity);
			await marketplace.write.approveTask([taskId], { account: admin.account });
			const requestId = await coordinator.read.latestRequestId();

			await coordinator.write.fulfill([
				requestId,
				[testCase.priceWord, testCase.durationWord],
			]);

			const task = (await marketplace.read.getTask([taskId])) as TaskView;
			assert.equal(task.status, 3);
			assert.equal(task.price, parseEther(testCase.price));
			assert.equal(task.closesAt - task.opensAt, BigInt(testCase.hours * 3600));
		}
	});

	it("rejects unknown, duplicate, malformed, and unauthorized VRF callbacks", async () => {
		const { coordinator, marketplace } = await deploySystem();
		const { taskId } = await requestTask(marketplace);
		await marketplace.write.approveTask([taskId], { account: admin.account });
		const requestId = await coordinator.read.latestRequestId();

		await viem.assertions.revertWithCustomErrorWithArgs(
			coordinator.write.fulfillConsumer([marketplace.address, 999n, [0n, 0n]]),
			marketplace,
			"UnknownRequest",
			[999n],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			coordinator.write.fulfill([requestId, [0n]]),
			marketplace,
			"InvalidRandomWords",
			[1n],
		);
		await coordinator.write.fulfill([requestId, [0n, 0n]]);
		await viem.assertions.revertWithCustomErrorWithArgs(
			coordinator.write.fulfill([requestId, [1n, 1n]]),
			marketplace,
			"InvalidTaskStatus",
			[taskId, 2, 3],
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

	it("lets only Owner pause an active task", async () => {
		const { coordinator, marketplace } = await deploySystem();
		const { taskId } = await requestTask(marketplace);

		await viem.assertions.revertWithCustomErrorWithArgs(
			marketplace.write.setTaskPaused([taskId, true], {
				account: admin.account,
			}),
			marketplace,
			"InvalidTaskStatus",
			[taskId, 3, 1],
		);
		await marketplace.write.approveTask([taskId], { account: admin.account });
		await coordinator.write.fulfill([
			await coordinator.read.latestRequestId(),
			[0n, 0n],
		]);
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

	it("uses exact approval and msg.sender to pay the Provider", async () => {
		const system = await deploySystem();
		const taskId = await activateTask(system);
		const task = (await system.marketplace.read.getTask([taskId])) as TaskView;
		const purchaseId = await system.marketplace.read.nextPurchaseId();
		await system.token.write.mintTest(
			[parent.account.address, parseEther("7")],
			{
				account: admin.account,
			},
		);
		await system.token.write.approve([system.marketplace.address, task.price], {
			account: parent.account,
		});
		const providerBefore = (await system.token.read.balanceOf([
			provider.account.address,
		])) as bigint;
		const parentBefore = (await system.token.read.balanceOf([
			parent.account.address,
		])) as bigint;

		await system.marketplace.write.buy([taskId], { account: parent.account });

		const providerAfter = (await system.token.read.balanceOf([
			provider.account.address,
		])) as bigint;
		const parentAfter = (await system.token.read.balanceOf([
			parent.account.address,
		])) as bigint;
		const purchase = (await system.marketplace.read.getPurchase([
			purchaseId,
		])) as PurchaseView;
		assert.equal(providerAfter - providerBefore, task.price);
		assert.equal(parentBefore - parentAfter, task.price);
		assert.equal(
			await system.token.read.lifetimeEarned([parent.account.address]),
			0n,
		);
		assert.equal(purchase.buyer, getAddress(parent.account.address));
		assert.equal(purchase.taskId, taskId);
		assert.equal(purchase.price, task.price);
		assert.equal(purchase.completed, false);
		assert.equal(
			await system.marketplace.read.purchaseIdForBuyer([
				taskId,
				parent.account.address,
			]),
			purchaseId,
		);
		assert.equal(
			await system.token.read.allowance([
				parent.account.address,
				system.marketplace.address,
			]),
			0n,
		);
	});

	it("rejects missing allowance, missing balance, and duplicate purchases", async () => {
		const noAllowance = await deploySystem();
		const noAllowanceTaskId = await activateTask(noAllowance);
		const noAllowanceTask = (await noAllowance.marketplace.read.getTask([
			noAllowanceTaskId,
		])) as TaskView;
		await noAllowance.token.write.mintTest(
			[parent.account.address, noAllowanceTask.price],
			{ account: admin.account },
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			noAllowance.marketplace.write.buy([noAllowanceTaskId], {
				account: parent.account,
			}),
			noAllowance.token,
			"ERC20InsufficientAllowance",
			[noAllowance.marketplace.address, 0n, noAllowanceTask.price],
		);

		const noBalance = await deploySystem();
		const noBalanceTaskId = await activateTask(noBalance);
		const noBalanceTask = (await noBalance.marketplace.read.getTask([
			noBalanceTaskId,
		])) as TaskView;
		await noBalance.token.write.approve(
			[noBalance.marketplace.address, noBalanceTask.price],
			{ account: parent.account },
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			noBalance.marketplace.write.buy([noBalanceTaskId], {
				account: parent.account,
			}),
			noBalance.token,
			"ERC20InsufficientBalance",
			[parent.account.address, 0n, noBalanceTask.price],
		);

		const duplicate = await deploySystem();
		const duplicateTaskId = await activateTask(duplicate);
		const duplicateTask = (await duplicate.marketplace.read.getTask([
			duplicateTaskId,
		])) as TaskView;
		await duplicate.token.write.mintTest(
			[parent.account.address, duplicateTask.price * 2n],
			{ account: admin.account },
		);
		await duplicate.token.write.approve(
			[duplicate.marketplace.address, duplicateTask.price * 2n],
			{ account: parent.account },
		);
		await duplicate.marketplace.write.buy([duplicateTaskId], {
			account: parent.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			duplicate.marketplace.write.buy([duplicateTaskId], {
				account: parent.account,
			}),
			duplicate.marketplace,
			"TaskAlreadyPurchased",
			[duplicateTaskId, parent.account.address, 1n],
		);
	});

	it("rejects purchases before activation, after rejection, while paused, and at expiry", async () => {
		const pending = await deploySystem();
		const { taskId: pendingTaskId } = await requestTask(pending.marketplace);
		await viem.assertions.revertWithCustomErrorWithArgs(
			pending.marketplace.write.buy([pendingTaskId], {
				account: parent.account,
			}),
			pending.marketplace,
			"InvalidTaskStatus",
			[pendingTaskId, 3, 1],
		);

		const rejected = await deploySystem();
		const { taskId: rejectedTaskId } = await requestTask(rejected.marketplace);
		await rejected.marketplace.write.rejectTask(
			[rejectedTaskId, keccak256(toBytes("rejected"))],
			{ account: admin.account },
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			rejected.marketplace.write.buy([rejectedTaskId], {
				account: parent.account,
			}),
			rejected.marketplace,
			"InvalidTaskStatus",
			[rejectedTaskId, 3, 4],
		);

		const paused = await deploySystem();
		const pausedTaskId = await activateTask(paused);
		await paused.marketplace.write.setTaskPaused([pausedTaskId, true], {
			account: admin.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			paused.marketplace.write.buy([pausedTaskId], { account: parent.account }),
			paused.marketplace,
			"TaskIsPaused",
			[pausedTaskId],
		);

		const expired = await deploySystem();
		const expiredTaskId = await activateTask(expired);
		const expiredTask = (await expired.marketplace.read.getTask([
			expiredTaskId,
		])) as TaskView;
		await networkHelpers.time.setNextBlockTimestamp(
			Number(expiredTask.closesAt),
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			expired.marketplace.write.buy([expiredTaskId], {
				account: parent.account,
			}),
			expired.marketplace,
			"TaskExpired",
			[expiredTaskId, expiredTask.closesAt],
		);
	});

	it("lets only the Relayer complete once and returns the same SBT on retry", async () => {
		const system = await deploySystem();
		const taskId = await activateTask(system);
		const task = (await system.marketplace.read.getTask([taskId])) as TaskView;
		await system.token.write.mintTest([parent.account.address, task.price], {
			account: admin.account,
		});
		await system.token.write.approve([system.marketplace.address, task.price], {
			account: parent.account,
		});
		const purchaseId = await system.marketplace.read.nextPurchaseId();
		await system.marketplace.write.buy([taskId], { account: parent.account });
		const relayerRole = await system.marketplace.read.COMPLETION_RELAYER_ROLE();
		await system.marketplace.write.grantRole(
			[relayerRole, relayer.account.address],
			{ account: admin.account },
		);
		const evidenceHash = keccak256(toBytes("completion-evidence-1"));
		const certificateUri = "ipfs://certificate/purchase-1";

		await viem.assertions.revertWithCustomErrorWithArgs(
			system.marketplace.write.confirmCompletion(
				[purchaseId, evidenceHash, certificateUri],
				{ account: outsider.account },
			),
			system.marketplace,
			"AccessControlUnauthorizedAccount",
			[outsider.account.address, relayerRole],
		);
		await system.marketplace.write.confirmCompletion(
			[purchaseId, evidenceHash, certificateUri],
			{ account: relayer.account },
		);
		await system.marketplace.write.confirmCompletion(
			[purchaseId, evidenceHash, certificateUri],
			{ account: relayer.account },
		);

		const purchase = (await system.marketplace.read.getPurchase([
			purchaseId,
		])) as PurchaseView;
		assert.equal(purchase.completed, true);
		assert.equal(purchase.evidenceHash, evidenceHash);
		assert.equal(purchase.certificateTokenId, 1n);
		assert.equal(await system.certificate.read.nextTokenId(), 2n);
		assert.equal(await system.certificate.read.locked([1n]), true);
		assert.equal(
			await system.certificate.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);

		await viem.assertions.revertWithCustomErrorWithArgs(
			system.marketplace.write.confirmCompletion(
				[purchaseId, keccak256(toBytes("different")), certificateUri],
				{ account: relayer.account },
			),
			system.marketplace,
			"CompletionConflict",
			[purchaseId],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			system.marketplace.write.confirmCompletion(
				[purchaseId, evidenceHash, "ipfs://certificate/changed"],
				{ account: relayer.account },
			),
			system.certificate,
			"CertificateConflict",
			[purchaseId, 1n],
		);
	});

	it("rejects completion for an unknown purchase", async () => {
		const system = await deploySystem();
		const relayerRole = await system.marketplace.read.COMPLETION_RELAYER_ROLE();
		await system.marketplace.write.grantRole(
			[relayerRole, relayer.account.address],
			{ account: admin.account },
		);

		await viem.assertions.revertWithCustomErrorWithArgs(
			system.marketplace.write.confirmCompletion(
				[99n, keccak256(toBytes("missing")), "ipfs://certificate/missing"],
				{ account: relayer.account },
			),
			system.marketplace,
			"UnknownPurchase",
			[99n],
		);
	});
});
