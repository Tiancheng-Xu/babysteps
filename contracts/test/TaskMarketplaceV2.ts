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

describe("TaskMarketplaceV2 review and randomness", async () => {
	const { viem } = await network.create();
	const [admin, provider, outsider] = await viem.getWalletClients();

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
});
